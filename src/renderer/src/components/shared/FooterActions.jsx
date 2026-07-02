import React from 'react';
import { Loader2 } from 'lucide-react';

export default function FooterActions({
  onSaveDraft,
  onPublish,
  accentColor,
  publishLabel = '立即发布',
  isPublishing = false,
}) {
  return (
    <div className="pt-6 flex justify-center gap-3 border-t border-gray-100">
      <button
        onClick={onSaveDraft}
        disabled={isPublishing}
        className="px-8 py-2.5 bg-white border border-gray-300 text-[#666] rounded-xl text-[13px] font-bold hover:bg-[#f9f9f9] transition shadow-sm disabled:opacity-50"
      >
        存入草稿
      </button>
      <button
        onClick={onPublish}
        disabled={isPublishing}
        className="px-12 py-2.5 text-white rounded-xl shadow-md text-[14px] font-black transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
        style={{ backgroundColor: accentColor, boxShadow: `0 4px 12px ${accentColor}40` }}
      >
        {isPublishing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            发布中...
          </>
        ) : (
          publishLabel
        )}
      </button>
    </div>
  );
}