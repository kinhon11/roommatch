import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook để fetch data với trạng thái loading và error
 * @param {Function} fetchFn - Hàm fetch trả về Promise
 * @param {Array} deps - Dependencies để re-fetch
 */
const useFetch = (fetchFn, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
};

export default useFetch;
