export default function useScheduleState(cfg, set) {
  const scheduleType = cfg.scheduleType || 'now';
  const scheduleTime = cfg.scheduleTime || '';

  const handleScheduleChange = (type) => {
    set('scheduleType', type);
    set('scheduled', type !== 'now');
  };

  const setScheduleTime = (time) => set('scheduleTime', time);

  return { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime };
}
