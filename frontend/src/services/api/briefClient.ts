import axios, {
    AxiosHeaders,
    AxiosInstance,
    InternalAxiosRequestConfig,
} from 'axios';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:8000/api/v1';

const briefApiClient: AxiosInstance =
    axios.create({
        baseURL: API_BASE_URL,

        headers: {
            Accept: 'application/json',
            'X-Requested-With':
                'XMLHttpRequest',
        },
    });

briefApiClient.interceptors.request.use(
    (
        config:
            InternalAxiosRequestConfig
    ) => {
        if (
            !(
                config.headers instanceof
                AxiosHeaders
            )
        ) {
            config.headers =
                new AxiosHeaders(
                    config.headers
                );
        }

        if (
            typeof window !==
            'undefined'
        ) {
            const token =
                sessionStorage.getItem(
                    'brief_auth_token'
                );

            if (token) {
                config.headers.set(
                    'Authorization',
                    `Bearer ${token}`
                );
            }
        }

        return config;
    }
);

briefApiClient.interceptors.response.use(
    (response) => response,

    (error) => {
        if (
            error.response?.status ===
            401 &&
            typeof window !==
            'undefined'
        ) {
            sessionStorage.removeItem(
                'brief_auth_token'
            );

            sessionStorage.removeItem(
                'brief_auth_user'
            );
        }

        return Promise.reject(error);
    }
);

export default briefApiClient;