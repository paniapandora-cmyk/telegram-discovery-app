import { useEffect } from 'react';
import DiscoveryApp from './app/DiscoveryApp';
import AIChat from './components/AIChat';
import OnboardingGate from './components/OnboardingGate';
import { recordIncomingReferralFromLocation } from './data/growth';

function App() {
    useEffect(() => {
        void recordIncomingReferralFromLocation().catch(() => {});
    }, []);

    const refreshPersonalizedFeed = () => {
        window.setTimeout(() => window.location.reload(), 120);
    };

    return (
        <>
            <DiscoveryApp />
            <AIChat />
            <OnboardingGate onComplete={refreshPersonalizedFeed} />
        </>
    );
}

export default App;
