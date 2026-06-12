import React from 'react';

interface Plan {
  id: string;
  name: string;
  price: string;
  popular?: boolean;
  features: string[];
  description: string;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter Pro',
    price: '$10',
    description: 'Advanced AI deep-packet threat remediation.',
    features: [
      'Core AI packet scanning',
      'Single subnet sweep limits',
      'Email alert summaries'
    ]
  },
  {
    id: 'analyst',
    name: 'Analyst Pro',
    price: '$25',
    popular: true,
    description: 'Multi-subnet sweeping & custom ML training.',
    features: [
      'Multi-subnet sweeps',
      'ML model parameter configuration',
      '24/7 Event Log persistence',
      'Groq AI advisory report access'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise Defense',
    price: '$50',
    description: 'Software-Defined Network (SDN) endpoints.',
    features: [
      'SDN integrations API',
      'High-velocity automated blocks',
      'Forensic diagnostics exports',
      'Dedicated support channels'
    ]
  }
];

interface UpgradePlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planName: string) => void;
}

const UpgradePlansModal: React.FC<UpgradePlansModalProps> = ({ isOpen, onClose, onSelectPlan }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl mx-4 bg-[#0a0a0a] border border-surface rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col font-mono text-main">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-muted hover:text-white transition-colors outline-none cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold text-primary mb-3 uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">crown</span>
            IPS Premium Remediator
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">Intelli IPS Premium Plans</h2>
          <p className="text-xs text-muted mt-1.5 max-w-lg mx-auto leading-relaxed">
            Upgrade your threat detection capability with dedicated ML model optimization, hardware-level SDN automation, and full-spectrum forensic log insights.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              className={`relative border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                plan.popular 
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' 
                  : 'border-surface bg-surface-highlight/30 hover:border-surface-highlight'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-primary text-white text-[9px] font-bold uppercase tracking-wider rounded-full shadow">
                  Recommended
                </span>
              )}

              <div>
                <h3 className="text-sm font-black uppercase text-white tracking-wide">{plan.name}</h3>
                <p className="text-[10px] text-muted leading-relaxed mt-1 min-h-[30px]">{plan.description}</p>
                
                <div className="flex items-baseline gap-1 my-4">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-[10px] text-muted">/ month</span>
                </div>

                <div className="h-px bg-surface mb-4"></div>

                <ul className="space-y-2 text-[10px] text-muted">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-primary">done</span>
                      <span className="truncate">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => onSelectPlan(plan.name)}
                className={`w-full mt-6 py-2 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer outline-none ${
                  plan.popular
                    ? 'bg-primary hover:bg-[#3A5ECA] text-white shadow-lg shadow-primary/10'
                    : 'bg-surface hover:bg-surface-highlight text-main border border-surface hover:border-surface-highlight'
                }`}
              >
                Select {plan.name}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center">
          <button 
            onClick={onClose}
            className="text-[10px] text-muted hover:text-white uppercase tracking-widest transition-colors outline-none cursor-pointer"
          >
            Stay on Demo License
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlansModal;
