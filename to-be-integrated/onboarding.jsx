// PRISM Onboarding Flow — for new users added to a review chain for the first time

function OnboardingFlow({ onComplete }) {
  const [step, setStep] = React.useState(0); // 0=welcome, 1=profile, 2=tour
  const [profile, setProfile] = React.useState({ displayName: '', pronouns: '', department: '', notifyEmail: true, notifyDigest: false });
  const [animDir, setAnimDir] = React.useState('forward');
  const [visible, setVisible] = React.useState(true);

  function goTo(next) {
    setAnimDir(next > step ? 'forward' : 'back');
    setVisible(false);
    setTimeout(() => { setStep(next); setVisible(true); }, 180);
  }

  const steps = [
    { label: 'Welcome', icon: 'waving_hand' },
    { label: 'Your Profile', icon: 'person' },
    { label: 'Quick Tour', icon: 'explore' },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #f6f8f6 0%, #eef5ef 50%, #e8f4ea 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: "'Public Sans', sans-serif"
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
        <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 48 48" width="20" height="20" fill="white">
            <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="white" fillRule="evenodd" />
          </svg>
        </div>
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--slate-900)' }}>PRISM</span>
      </div>

      {/* Step pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999,
              background: i === step ? 'var(--primary)' : i < step ? 'var(--primary-dim)' : 'white',
              border: `1.5px solid ${i === step ? 'var(--primary)' : i < step ? 'var(--primary)' : 'var(--slate-200)'}`,
              transition: 'all 0.2s',
            }}>
              <span className="ms" style={{ fontSize: 14, color: i === step ? 'white' : i < step ? 'var(--primary-dark)' : 'var(--slate-400)' }}>{i < step ? 'check_circle' : s.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: i === step ? 'white' : i < step ? 'var(--primary-dark)' : 'var(--slate-400)', letterSpacing: '0.01em' }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 24, height: 1.5, background: i < step ? 'var(--primary)' : 'var(--slate-200)', transition: 'background 0.3s' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'white', borderRadius: 24,
        border: '1.5px solid var(--slate-200)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : (animDir === 'forward' ? 'translateY(12px)' : 'translateY(-12px)'),
        transition: 'opacity 0.18s ease, transform 0.18s ease',
      }}>
        {step === 0 && <WelcomeStep onNext={() => goTo(1)} />}
        {step === 1 && <ProfileStep profile={profile} setProfile={setProfile} onBack={() => goTo(0)} onNext={() => goTo(2)} />}
        {step === 2 && <TourStep onBack={() => goTo(1)} onComplete={onComplete} />}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--slate-400)' }}>
        Need help? Contact <span style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>admin@plaksha.edu.in</span>
      </p>
    </div>
  );
}

function WelcomeStep({ onNext }) {
  return (
    <div style={{ padding: '48px 40px 40px' }}>
      {/* Illustration area */}
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 28,
        background: 'linear-gradient(135deg, #e8f9ec, #d0f5d8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid rgba(17,212,50,0.2)'
      }}>
        <span className="ms" style={{ fontSize: 36, color: 'var(--primary)' }}>waving_hand</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--slate-900)', letterSpacing: '-0.5px', marginBottom: 12, lineHeight: 1.2 }}>
        You've been added<br />to a review chain
      </h1>
      <p style={{ fontSize: 15, color: 'var(--slate-500)', lineHeight: 1.65, marginBottom: 10 }}>
        PRISM is the approvals platform used at Plaksha to manage student outward mobility applications. You've been assigned as a reviewer.
      </p>
      <p style={{ fontSize: 14, color: 'var(--slate-400)', lineHeight: 1.65, marginBottom: 32 }}>
        This takes about <strong style={{ color: 'var(--slate-600)' }}>2 minutes</strong> to set up. You'll configure your profile and see how your inbox works.
      </p>

      {/* Role badge */}
      <div style={{
        padding: '14px 18px', borderRadius: 14,
        background: 'var(--bg-light)', border: '1.5px solid var(--slate-200)',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms" style={{ color: 'var(--primary-dark)', fontSize: 20 }}>verified_user</span>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Role</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-800)' }}>Reviewer / Approver</div>
        </div>
      </div>

      <PrismButton onClick={onNext} fullWidth icon="arrow_forward" iconRight>
        Get Started
      </PrismButton>
    </div>
  );
}

function ProfileStep({ profile, setProfile, onBack, onNext }) {
  const departments = ['Faculty', 'Academic Affairs', 'International Relations', 'Student Affairs', 'Administration', 'Other'];
  const [errors, setErrors] = React.useState({});

  function validate() {
    const e = {};
    if (!profile.displayName.trim()) e.displayName = 'Display name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div style={{ padding: '40px 40px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms" style={{ color: 'var(--primary)', fontSize: 24 }}>person</span>
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.3px' }}>Your Profile</h2>
          <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>This is how you'll appear in PRISM</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 32 }}>
        <FieldGroup label="Display Name" required error={errors.displayName}>
          <PrismInput
            placeholder="e.g. Dr. Ananya Krishnan"
            value={profile.displayName}
            onChange={v => setProfile(p => ({ ...p, displayName: v }))}
            error={!!errors.displayName}
          />
        </FieldGroup>

        <FieldGroup label="Pronouns" hint="Optional — shown to colleagues">
          <PrismInput
            placeholder="e.g. she/her, he/him, they/them"
            value={profile.pronouns}
            onChange={v => setProfile(p => ({ ...p, pronouns: v }))}
          />
        </FieldGroup>

        <FieldGroup label="Department / Team">
          <select
            value={profile.department}
            onChange={e => setProfile(p => ({ ...p, department: e.target.value }))}
            style={{
              width: '100%', height: 44, borderRadius: 10,
              border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)',
              padding: '0 14px', fontSize: 14, color: 'var(--slate-700)',
              fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
              appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
            }}
          >
            <option value="">Select department…</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </FieldGroup>

        {/* Notification prefs */}
        <div style={{ padding: '16px 18px', background: 'var(--slate-50)', borderRadius: 14, border: '1.5px solid var(--slate-200)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Notifications</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ToggleRow
              label="Email me when an application needs my action"
              checked={profile.notifyEmail}
              onChange={v => setProfile(p => ({ ...p, notifyEmail: v }))}
            />
            <ToggleRow
              label="Send a daily digest of pending items"
              checked={profile.notifyDigest}
              onChange={v => setProfile(p => ({ ...p, notifyDigest: v }))}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <PrismButton variant="ghost" onClick={onBack} icon="arrow_back">Back</PrismButton>
        <PrismButton fullWidth onClick={() => { if (validate()) onNext(); }} icon="arrow_forward" iconRight>Save & Continue</PrismButton>
      </div>
    </div>
  );
}

function TourStep({ onBack, onComplete }) {
  const [activeCard, setActiveCard] = React.useState(0);

  const cards = [
    { icon: 'inbox', color: '#3b82f6', bg: '#eff6ff', title: 'Your Task Inbox', body: 'Every application assigned to you lands here. You\'ll see SLA deadlines, applicant info, and the current stage.' },
    { icon: 'fact_check', color: '#8b5cf6', bg: '#f5f3ff', title: 'Reviewing Applications', body: 'Open any application to see the applicant\'s data, leave comments, and take a decision — Approve, Request Changes, or Reject.' },
    { icon: 'notifications', color: '#f59e0b', bg: '#fffbeb', title: 'You\'ll be notified', body: 'When an application reaches your stage, you\'ll receive an email. You can configure frequency in your profile settings.' },
    { icon: 'lock', color: '#10b981', bg: '#ecfdf5', title: 'Scoped Access', body: 'You only see data you\'re permitted to see. Each opportunity defines which fields are visible at your stage.' },
  ];

  return (
    <div style={{ padding: '40px 40px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms" style={{ color: '#f59e0b', fontSize: 24 }}>explore</span>
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.3px' }}>Quick Tour</h2>
          <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>What you need to know to get started</p>
        </div>
      </div>

      {/* Tour cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {cards.map((c, i) => (
          <button
            key={i}
            onClick={() => setActiveCard(activeCard === i ? -1 : i)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: activeCard === i ? c.bg : 'var(--slate-50)',
              border: `1.5px solid ${activeCard === i ? c.color + '40' : 'var(--slate-200)'}`,
              borderRadius: 14, padding: '14px 16px', transition: 'all 0.15s',
              outline: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ms" style={{ color: c.color, fontSize: 22 }}>{c.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-800)', flex: 1 }}>{c.title}</span>
              <span className="ms" style={{ fontSize: 16, color: 'var(--slate-400)', transform: activeCard === i ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>expand_more</span>
            </div>
            {activeCard === i && (
              <p style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.6, marginTop: 10, paddingLeft: 34 }}>{c.body}</p>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <PrismButton variant="ghost" onClick={onBack} icon="arrow_back">Back</PrismButton>
        <PrismButton fullWidth onClick={onComplete} icon="check_circle" iconRight>Go to My Inbox</PrismButton>
      </div>
    </div>
  );
}

// ── Shared UI primitives ──

function PrismButton({ children, onClick, variant = 'primary', fullWidth, icon, iconRight, disabled, style: extraStyle }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, padding: '0 20px', borderRadius: 12, border: 'none',
    fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s', outline: 'none',
    width: fullWidth ? '100%' : undefined, opacity: disabled ? 0.5 : 1,
    ...(extraStyle || {})
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'white', boxShadow: '0 4px 14px rgba(17,212,50,0.3)' },
    ghost: { background: 'var(--slate-100)', color: 'var(--slate-700)', boxShadow: 'none' },
    outline: { background: 'white', color: 'var(--slate-700)', border: '1.5px solid var(--slate-200)', boxShadow: 'none' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
      {icon && !iconRight && <span className="ms" style={{ fontSize: 18 }}>{icon}</span>}
      {children}
      {icon && iconRight && <span className="ms" style={{ fontSize: 18 }}>{icon}</span>}
    </button>
  );
}

function FieldGroup({ label, required, hint, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {required && <span style={{ color: '#ef4444', fontSize: 12 }}>*</span>}
        {hint && <span style={{ fontWeight: 400, color: 'var(--slate-400)', fontSize: 12 }}>— {hint}</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

function PrismInput({ value, onChange, placeholder, error, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 44, borderRadius: 10,
        border: `1.5px solid ${error ? '#fca5a5' : 'var(--slate-200)'}`,
        background: error ? '#fff5f5' : 'var(--slate-50)',
        padding: '0 14px', fontSize: 14, color: 'var(--slate-800)',
        fontFamily: 'inherit', outline: 'none', transition: 'border 0.15s',
      }}
      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
      onBlur={e => e.target.style.borderColor = error ? '#fca5a5' : 'var(--slate-200)'}
    />
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.4 }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: checked ? 'var(--primary)' : 'var(--slate-300)',
          border: 'none', cursor: 'pointer', position: 'relative',
          flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3,
          left: checked ? 21 : 3,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </button>
    </div>
  );
}

Object.assign(window, { OnboardingFlow, PrismButton, FieldGroup, PrismInput, ToggleRow });
