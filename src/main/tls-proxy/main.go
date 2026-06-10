// Matrix TLS Proxy — 本地 HTTPS 转发代理
// 使用 uTLS 伪装 Chrome 133 JA3 指纹，绕过小红书 TLS 级风控
//
// 架构:
//   BrowserView → CONNECT → 本代理(127.0.0.1:7891)
//     ├─ xhscdn.com / xiaohongshu.com → MITM 模式
//     │    Browser ←TLS(CA 签发证书)→ 代理 ←TLS(uTLS Chrome133)→ 目标
//     └─ 其他域名 → 直通模式 (TCP 透明转发)
//
// CA 体系:
//   首次启动生成根 CA (ca-cert.pem + ca-key.pem)，导入 Windows 信任存储后，
//   代理可为任意 MITM 域名签发被浏览器信任的叶子证书，彻底消除 -107 错误。

package main

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"flag"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	utls "github.com/refraction-networking/utls"
)

var (
	listenAddr = flag.String("listen", "127.0.0.1:7891", "代理监听地址")
	upstream   = flag.String("upstream", "", "上游代理地址 (如 socks5://127.0.0.1:1080)")
	certsDir   = flag.String("certsDir", "", "证书存储目录 (默认 %APPDATA%/yumatrix-studio/tls-proxy-certs)")

	// MITM 目标域名 — 使用 uTLS Chrome 133 JA3 指纹转发
	// 注意: MITM 需要 CA 证书导入系统信任存储，否则自动降级为纯 TCP 中继。
	mitmSuffixes = []string{
		"xhscdn.com",         // CDN 静态资源
		"xiaohongshu.com",    // 主站 + 创作者平台
		"xiaohongshu.net",    // 备用 CDN
		"xhslink.com",        // 短链服务
	}

	// CA 是否已导入系统信任存储 — 启动后 2s 检测
	caTrustedByOS = false

	// CA 证书 (启动时加载)
	caCert     *x509.Certificate
	caKey      *ecdsa.PrivateKey
	caCertPEM  []byte
	certCache  sync.Map // string → *tls.Certificate
	caJustCreated bool
)

func main() {
	flag.Parse()
	log.SetFlags(log.Ltime)

	// 证书目录
	cd := *certsDir
	if cd == "" {
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = os.Getenv("HOME")
		}
		cd = filepath.Join(appData, "yumatrix-studio", "tls-proxy-certs")
	}
	if err := os.MkdirAll(cd, 0750); err != nil {
		log.Fatalf("无法创建证书目录 %s: %v", cd, err)
	}

	// 加载或创建 CA
	loadOrCreateCA(cd)

	if *upstream != "" {
		log.Printf("上游代理: %s", *upstream)
	}
	log.Printf("Matrix TLS Proxy 启动 → %s (raw TCP 模式)", *listenAddr)
	log.Printf("JA3 伪装: Chrome 133 | MITM 域名: %s", strings.Join(mitmSuffixes, ", "))

	if caJustCreated {
		certFile := filepath.Join(cd, "ca-cert.pem")
		log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		log.Println("⚠ 根 CA 已生成，需导入系统信任存储 (仅一次)：")
		log.Println("")
		log.Println("  Windows (管理员 PowerShell):")
		log.Printf("    Import-Certificate -FilePath \"%s\" -CertStoreLocation Cert:\\LocalMachine\\Root", certFile)
		log.Println("")
		log.Println("  macOS (终端):")
		log.Printf("    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \"%s\"", certFile)
		log.Println("")
		log.Println("  导入后重启应用即可启用 MITM + JA3 伪装。")
		log.Println("  未导入前，代理以纯中继模式运行 (不改 JA3)。")
		log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	}

	// 启动后延迟检测 CA 是否已导入系统信任存储
	go func() {
		time.Sleep(2 * time.Second)
		caTrustedByOS = checkCATrusted(cd)
		if caTrustedByOS {
			log.Println("[CA] ✓ 根 CA 已在系统信任存储中 — MITM + JA3 伪装已激活")
		} else {
			log.Println("[CA] 根 CA 未在系统信任存储中 — 纯中继模式 (页面正常加载)")
		}
	}()

	// 使用 raw TCP 监听，避免 net/http 的 hijack 缓冲问题
	ln, err := net.Listen("tcp", *listenAddr)
	if err != nil {
		log.Fatalf("启动失败: %v", err)
	}
	log.Printf("代理监听: %s", *listenAddr)

	go func() {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
		<-ch
		log.Println("正在关闭...")
		ln.Close()
	}()

	for {
		conn, err := ln.Accept()
		if err != nil {
			// ln.Close() 触发后 err 非 nil，退出循环
			if opErr, ok := err.(*net.OpError); ok && opErr.Err.Error() == "use of closed network connection" {
				break
			}
			log.Printf("[ERR] Accept 失败: %v", err)
			continue
		}
		go handleRawConn(conn)
	}
	log.Println("代理已关闭")
}

// ── CA 加载/生成 ──

func loadOrCreateCA(cd string) {
	certPath := filepath.Join(cd, "ca-cert.pem")
	keyPath := filepath.Join(cd, "ca-key.pem")

	certPEM, err := os.ReadFile(certPath)
	if err == nil {
		keyPEM, err2 := os.ReadFile(keyPath)
		if err2 == nil {
			block, _ := pem.Decode(certPEM)
			if block != nil {
				c, err3 := x509.ParseCertificate(block.Bytes)
				if err3 == nil {
					kb, _ := pem.Decode(keyPEM)
					if kb != nil {
						k, err4 := x509.ParseECPrivateKey(kb.Bytes)
						if err4 == nil {
							caCert = c
							caKey = k
							caCertPEM = certPEM
							log.Printf("[CA] 已加载根 CA: %s", caCert.Subject.CommonName)
							return
						}
					}
				}
			}
		}
	}

	// 生成新 CA
	log.Println("[CA] 正在生成根 CA...")
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		log.Fatalf("[CA] 密钥生成失败: %v", err)
	}

	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   "Matrix TLS CA",
			Organization: []string{"YuMatrix Studio"},
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            0,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		log.Fatalf("[CA] 证书生成失败: %v", err)
	}

	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		log.Fatalf("[CA] 解析证书失败: %v", err)
	}

	// 写证书
	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	if err := os.WriteFile(certPath, certPEM, 0644); err != nil {
		log.Fatalf("[CA] 写入证书失败: %v", err)
	}

	// 写私钥 (仅本机可读)
	keyDER, _ := x509.MarshalECPrivateKey(key)
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		log.Fatalf("[CA] 写入私钥失败: %v", err)
	}

	caCert = cert
	caKey = key
	caCertPEM = certPEM
	caJustCreated = true
	log.Printf("[CA] 根 CA 已生成: Matrix TLS CA")
}

// ── HTTP 入口 ──

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		handleConnect(w, r)
		return
	}
	handleHTTP(w, r)
}

// ── Raw TCP 入口 (绕过 net/http，避免 hijack 缓冲问题) ──

func handleRawConn(client net.Conn) {
	br := bufio.NewReader(client)

	// 读取第一行: "CONNECT host:port HTTP/1.1" 或 "GET http://host/path HTTP/1.1"
	firstLine, err := br.ReadString('\n')
	if err != nil {
		client.Close()
		return
	}
	firstLine = strings.TrimRight(firstLine, "\r\n")

	// 读完剩余 headers（到空行结束）
	for {
		line, err := br.ReadString('\n')
		if err != nil {
			client.Close()
			return
		}
		if line == "\r\n" || line == "\n" {
			break
		}
	}

	parts := strings.SplitN(firstLine, " ", 3)
	if len(parts) < 3 {
		client.Close()
		return
	}
	method, target, _ := parts[0], parts[1], parts[2]
	log.Printf("[PROXY] %s %s (from %s)", method, target, client.RemoteAddr())

	if method == "CONNECT" {
		// HTTPS 隧道: target = "host:443"
		hostname, _, _ := net.SplitHostPort(target)
		if hostname == "" {
			hostname = target
		}

		if shouldMITM(hostname) {
			// MITM 模式: 拦截 TLS，用 uTLS Chrome 133 重新握手
			client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
			log.Printf("[CONNECT] MITM → %s", target)
			handleMITMRaw(client, hostname, target)
		} else {
			// 纯中继: 原封不动转发 TCP 字节
			upstream, err := dialTarget(target)
			if err != nil {
				log.Printf("[CONNECT] 拨号失败 %s: %v", target, err)
				client.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
				client.Close()
				return
			}
			client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
			log.Printf("[CONNECT] 直通 → %s", target)
			relay(client, upstream)
			client.Close()
			upstream.Close()
		}
	} else {
		// 普通 HTTP 请求: "GET http://host/path HTTP/1.1"
		// 解析 target URL 提取 host
		u, err := url.Parse(target)
		if err != nil || u.Host == "" {
			client.Close()
			return
		}
		host := u.Host
		if !strings.Contains(host, ":") {
			host = host + ":80"
		}

		log.Printf("[HTTP] %s %s → %s", method, u.RequestURI(), host)
		upstream, err := dialTarget(host)
		if err != nil {
			log.Printf("[HTTP] 拨号失败 %s: %v", host, err)
			client.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
			client.Close()
			return
		}

		// 转发: 重写请求行（去掉 scheme，只留 path）
		requestLine := fmt.Sprintf("%s %s %s\r\n", method, u.RequestURI(), parts[2])
		upstream.Write([]byte(requestLine))
		// 转发已缓冲的 headers
		br.WriteTo(upstream)

		relay(client, upstream)
		client.Close()
		upstream.Close()
	}
}

// handleMITMRaw: raw TCP 版本的 MITM（不经过 net/http）
func handleMITMRaw(client net.Conn, hostname, targetHost string) {
	cert, err := getOrSignHostCert(hostname)
	if err != nil {
		log.Printf("[MITM] 签发证书失败 %s: %v", hostname, err)
		client.Close()
		return
	}

	browserTLS := tls.Server(client, &tls.Config{
		Certificates: []tls.Certificate{*cert},
		MinVersion:   tls.VersionTLS12,
	})

	if err := browserTLS.Handshake(); err != nil {
		log.Printf("[MITM] 浏览器握手失败 %s: %v", hostname, err)
		browserTLS.Close()
		return
	}

	raw, err := dialTarget(targetHost)
	if err != nil {
		log.Printf("[MITM] 连接失败 %s: %v", hostname, err)
		browserTLS.Close()
		return
	}

	uconn := utls.UClient(raw, &utls.Config{
		ServerName: hostname,
	}, utls.HelloChrome_133)

	if err := uconn.Handshake(); err != nil {
		log.Printf("[MITM] uTLS 握手失败 %s: %v", hostname, err)
		browserTLS.Close()
		raw.Close()
		return
	}

	log.Printf("[MITM] ✓ %s (JA3→Chrome133, CA 签发)", hostname)
	relay(browserTLS, uconn)
	browserTLS.Close()
	uconn.Close()
}

func handleConnect(w http.ResponseWriter, r *http.Request) {
	targetHost := r.Host
	hostname, _, err := net.SplitHostPort(targetHost)
	if err != nil {
		hostname = targetHost
	}

	conn, err := hijack(w)
	if err != nil {
		log.Printf("[ERR] Hijack 失败: %v", err)
		return
	}

	if shouldMITM(hostname) {
		handleMITM(conn, hostname, targetHost)
	} else {
		handlePassthrough(conn, targetHost)
	}
}

func shouldMITM(hostname string) bool {
	if !caTrustedByOS {
		return false // CA 未导入系统信任存储 → 纯中继，不破坏响应
	}
	for _, s := range mitmSuffixes {
		if strings.HasSuffix(hostname, s) {
			return true
		}
	}
	return false
}

func handlePassthrough(client net.Conn, targetHost string) {
	defer client.Close()

	target, err := dialTarget(targetHost)
	if err != nil {
		return
	}
	defer target.Close()

	client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
	relay(client, target)
}

func handleMITM(client net.Conn, hostname, targetHost string) {
	defer client.Close()

	client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))

	// 用 CA 签发叶子证书（替代自签）
	cert, err := getOrSignHostCert(hostname)
	if err != nil {
		log.Printf("[MITM] 签发证书失败 %s: %v", hostname, err)
		return
	}

	browserTLS := tls.Server(client, &tls.Config{
		Certificates: []tls.Certificate{*cert},
		MinVersion:   tls.VersionTLS12,
	})
	defer browserTLS.Close()

	if err := browserTLS.Handshake(); err != nil {
		log.Printf("[MITM] 浏览器握手失败 %s: %v", hostname, err)
		return
	}

	raw, err := dialTarget(targetHost)
	if err != nil {
		log.Printf("[MITM] 连接失败 %s: %v", hostname, err)
		return
	}
	defer raw.Close()

	uconn := utls.UClient(raw, &utls.Config{
		ServerName: hostname,
	}, utls.HelloChrome_133)

	if err := uconn.Handshake(); err != nil {
		log.Printf("[MITM] uTLS 握手失败 %s: %v", hostname, err)
		return
	}
	defer uconn.Close()

	log.Printf("[MITM] ✓ %s (JA3→Chrome133, CA 签发)", hostname)
	relay(browserTLS, uconn)
}

// ── 证书签发 (CA 签发叶子证书, 文件缓存) ──

func getOrSignHostCert(hostname string) (*tls.Certificate, error) {
	if c, ok := certCache.Load(hostname); ok {
		return c.(*tls.Certificate), nil
	}

	cd := *certsDir
	if cd == "" {
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = os.Getenv("HOME")
		}
		cd = filepath.Join(appData, "yumatrix-studio", "tls-proxy-certs")
	}

	certPath := filepath.Join(cd, "leaf-"+hostname+".pem")
	keyPath := filepath.Join(cd, "leaf-"+hostname+"-key.pem")

	// 尝试从文件加载
	if certPEM, err := os.ReadFile(certPath); err == nil {
		if keyPEM, err2 := os.ReadFile(keyPath); err2 == nil {
			c, err3 := tls.X509KeyPair(certPEM, keyPEM)
			if err3 == nil {
				certCache.Store(hostname, &c)
				return &c, nil
			}
		}
	}

	// 签发新证书
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("密钥生成失败: %w", err)
	}

	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: hostname},
		DNSNames:     []string{hostname},
		NotBefore:    time.Now().Add(-1 * time.Hour),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, caCert, &key.PublicKey, caKey)
	if err != nil {
		return nil, fmt.Errorf("签发失败: %w", err)
	}

	// 缓存到文件
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	keyDER, _ := x509.MarshalECPrivateKey(key)
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	os.WriteFile(certPath, certPEM, 0644)
	os.WriteFile(keyPath, keyPEM, 0600)

	c, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, fmt.Errorf("加载证书失败: %w", err)
	}

	certCache.Store(hostname, &c)
	return &c, nil
}

// ── CA 信任检测 ──

// checkCATrusted 检查根 CA 是否已导入系统信任存储
// Windows: certutil -verifystore Root
// macOS: security find-certificate
func checkCATrusted(cd string) bool {
	// 先检查 CA 证书文件是否存在
	certPath := filepath.Join(cd, "ca-cert.pem")
	if _, err := os.Stat(certPath); err != nil {
		return false
	}

	// 尝试加载 CA 证书获取 Subject
	certPEM, err := os.ReadFile(certPath)
	if err != nil {
		return false
	}
	block, _ := pem.Decode(certPEM)
	if block == nil {
		return false
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return false
	}
	cn := cert.Subject.CommonName

	// Windows: 检查证书是否在 Root 存储中
	if runtime.GOOS == "windows" {
		return exec.Command("certutil", "-verifystore", "Root", cn).Run() == nil
	}
	// macOS
	if runtime.GOOS == "darwin" {
		return exec.Command("security", "find-certificate", "-c", cn, "/Library/Keychains/System.keychain").Run() == nil
	}
	return false
}

// ── 工具 ──

func hijack(w http.ResponseWriter) (net.Conn, error) {
	hj, ok := w.(http.Hijacker)
	if !ok {
		return nil, fmt.Errorf("不支持 hijack")
	}
	conn, _, err := hj.Hijack()
	return conn, err
}

func dialTarget(targetHost string) (net.Conn, error) {
	if *upstream != "" {
		return dialViaUpstream(targetHost)
	}
	return net.DialTimeout("tcp", targetHost, 10*time.Second)
}

func dialViaUpstream(targetHost string) (net.Conn, error) {
	u, err := url.Parse(*upstream)
	if err != nil {
		return nil, fmt.Errorf("解析上游代理地址失败: %w", err)
	}
	upstreamAddr := u.Host

	conn, err := net.DialTimeout("tcp", upstreamAddr, 10*time.Second)
	if err != nil {
		return nil, err
	}

	switch u.Scheme {
	case "socks5":
		if err := socks5Handshake(conn, targetHost); err != nil {
			conn.Close()
			return nil, err
		}
	default:
		fmt.Fprintf(conn, "CONNECT %s HTTP/1.1\r\nHost: %s\r\n\r\n", targetHost, targetHost)
		var status string
		fmt.Fscanf(conn, "HTTP/1.1 %s", &status) //nolint
		if !strings.HasPrefix(status, "2") {
			conn.Close()
			return nil, fmt.Errorf("上游代理拒绝 CONNECT: %s", status)
		}
		buf := make([]byte, 1)
		nlCount := 0
		for nlCount < 4 {
			conn.Read(buf)
			if buf[0] == '\r' || buf[0] == '\n' {
				nlCount++
			} else {
				nlCount = 0
			}
		}
	}

	return conn, nil
}

func socks5Handshake(conn net.Conn, target string) error {
	host, portStr, err := net.SplitHostPort(target)
	if err != nil {
		return err
	}

	conn.Write([]byte{0x05, 0x01, 0x00})
	resp := make([]byte, 2)
	if _, err := io.ReadFull(conn, resp); err != nil {
		return err
	}
	if resp[1] != 0x00 {
		return fmt.Errorf("SOCKS5 认证失败")
	}

	hostBytes := []byte(host)
	conn.Write(append([]byte{0x05, 0x01, 0x00, 0x03, byte(len(hostBytes))}, hostBytes...))

	port, _ := net.LookupPort("tcp", portStr)
	conn.Write([]byte{byte(port >> 8), byte(port & 0xff)})

	resp2 := make([]byte, 10)
	if _, err := io.ReadFull(conn, resp2); err != nil {
		return err
	}
	if resp2[1] != 0x00 {
		return fmt.Errorf("SOCKS5 CONNECT 失败: code=%d", resp2[1])
	}
	return nil
}

func relay(a, b net.Conn) {
	done := make(chan struct{}, 2)
	go func() { io.Copy(b, a); done <- struct{}{} }()
	go func() { io.Copy(a, b); done <- struct{}{} }()
	// 等第一个方向完成（通常是响应方向 a←b），defer Close()
	// 会正确发送 TLS close_notify 唤醒对端阻塞的 io.Copy
	<-done
}

func handleHTTP(w http.ResponseWriter, r *http.Request) {
	transport := &http.Transport{}
	if *upstream != "" {
		u, _ := url.Parse(*upstream)
		transport.Proxy = http.ProxyURL(u)
	}
	resp, err := transport.RoundTrip(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	for k, v := range resp.Header {
		w.Header()[k] = v
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
