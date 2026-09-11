import { useEffect } from 'react';
import DiscoveryApp from './app/DiscoveryApp';
import AIChat from './components/AIChat';
import { recordIncomingReferralFromLocation } from './data/growth';

function App() {
    useEffect(() => {
        void recordIncomingReferralFromLocation().catch(() => {});
    }, []);

    return (
        <>
            <DiscoveryApp />
            <AIChat />
        </>
    );
}

export default App;
