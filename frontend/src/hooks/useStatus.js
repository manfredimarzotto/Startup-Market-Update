import { useState, useCallback } from 'react';

const STATUS_KEY = 'nsi_opportunity_status';

function loadStatuses() {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY)) || {};
  } catch {
    return {};
  }
}

export function useStatus() {
  const [statusMap, setStatusMap] = useState(loadStatuses);

  const getStatus = useCallback((oppId) => {
    return statusMap[oppId] || 'new';
  }, [statusMap]);

  const setStatus = useCallback((oppId, status) => {
    setStatusMap(prev => {
      const next = { ...prev, [oppId]: status };
      localStorage.setItem(STATUS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { getStatus, setStatus };
}
