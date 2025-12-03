import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // 백엔드 주소
  withCredentials: true, // 쿠키를 포함한 요청을 허용
  headers: {
    'Content-Type': 'application/json',
  },
});

export default instance;
