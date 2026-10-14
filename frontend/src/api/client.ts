import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  withCredentials: true, // Important for Django session auth
  xsrfCookieName: 'csrftoken', // Default Django CSRF cookie name
  xsrfHeaderName: 'X-CSRFToken', // Default Django CSRF header name
});

export default client;
