import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/live-media-v2.css';
import './styles/viewer-saved-v3.css';
import './styles/explore-search-v4.css';
import './styles/premium-v2.css';
import './styles/premium-v3.css';
import './styles/premium-v4.css';

const PRODUCTION_WORKER =
    'https://telegram-discovery-app.paniapandora.workers.dev';

if (location.hostname.endsWith('.pages.dev')) {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const raw =
            typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.href
                    : input.url;

        try {
            const url = new URL(raw, location.href);

            if (
                url.origin === PRODUCTION_WORKER &&
                url.pathname.startsWith('/api/')
            ) {
                const localUrl =
                    location.origin +
                    url.pathname +
                    url.search +
                    url.hash;

                if (input instanceof Request) {
                    return nativeFetch(new Request(localUrl, input), init);
                }

                return nativeFetch(localUrl, init);
            }
        } catch {
            // Keep the original request unchanged.
        }

        return nativeFetch(input, init);
    };
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
