import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Globe, Shield, Users, LogOut, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePatient } from '../context/PatientContext';
import { supabase } from '../lib/supabaseClient';

const TABS = [
  { id: 'profile', label: 'Account & Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'care-circle', label: 'Care Circle', icon: Users },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi (हिंदी)' },
  { value: 'ta', label: 'Tamil (தமிழ்)' },
];

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function StatusBanner({ type, message }) {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderRadius: 'var(--radius-sm)',
        background: isError ? 'var(--danger-bg)' : 'var(--success-bg)',
        border: `1px solid ${isError ? 'var(--danger)' : 'var(--success)'}`,
        color: isError ? 'var(--danger)' : 'var(--success)',
        fontSize: 13, fontWeight: 500,
        marginBottom: 16,
      }}
    >
      {isError ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
      {message}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{subtitle}</p>}
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--background)',
      border: '1px solid var(--border-strong)',
      color: 'var(--text-faint)',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>Coming soon</span>
  );
}

// ───── TAB: Account & Profile ────────────────────────────────
function ProfileTab({ user, caregiverProfile, reloadProfile }) {
  const [fullName, setFullName] = useState(caregiverProfile?.full_name || '');
  const [phone, setPhone] = useState(caregiverProfile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Keep form in sync when profile loads
  useEffect(() => {
    setFullName(caregiverProfile?.full_name || '');
    setPhone(caregiverProfile?.phone || '');
  }, [caregiverProfile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!fullName.trim()) { setStatus({ type: 'error', message: 'Full name cannot be empty.' }); return; }
    setSaving(true);
    setStatus({ type: '', message: '' });
    try {
      const { error } = await supabase
        .from('caregiver')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() })
        .eq('caregiver_id', user.id);
      if (error) throw error;
      await reloadProfile();
      setStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to save profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Account & Profile" subtitle="Manage your personal information." />

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
        }}>
          {initials(caregiverProfile?.full_name || user?.email)}
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', margin: 0 }}>
            {caregiverProfile?.full_name || '(No name set)'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Member since {formatDate(caregiverProfile?.created_at || user?.created_at)}
          </p>
        </div>
      </div>

      <StatusBanner type={status.type} message={status.message} />

      <form onSubmit={handleSave}>
        <div className="wt-form-grid">
          <div className="wt-form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              maxLength={100}
              required
            />
          </div>
          <div className="wt-form-group">
            <label>Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 90000 12345"
            />
          </div>
          <div className="wt-form-group">
            <label>Email <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(read-only)</span></label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              disabled
              style={{ background: 'var(--background)', cursor: 'not-allowed' }}
            />
            <p className="wt-field-hint">Email is managed by Supabase Auth. Use the login page to change it.</p>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button type="submit" className="wt-btn wt-btn--primary" disabled={saving}>
            <Save size={15} />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ───── TAB: Notifications ────────────────────────────────────
function NotificationsTab() {
  const navigate = useNavigate();
  return (
    <div>
      <SectionHeader
        title="Notification Preferences"
        subtitle="Control how and when you receive care alerts."
      />

      <div style={{
        background: 'var(--surface-warm)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 20,
      }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
          Per-patient notification settings
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Your notification preferences (alert priority and alert type) are configured per-patient
          in the Care Circle. Each patient can have different caregivers with different alert settings.
        </p>
        <button
          className="wt-btn wt-btn--ghost"
          onClick={() => navigate('/care-circle')}
        >
          <Users size={14} /> Go to Care Circle Settings
        </button>
      </div>

      <div style={{
        background: 'var(--background)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '16px 20px',
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>You receive notifications for</p>
        <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
          <li>Upcoming medication doses (15 minutes before scheduled time)</li>
          <li>Overdue medications not logged within 60 minutes</li>
          <li>Care coordination alerts when risk level is elevated</li>
        </ul>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>
          Notifications are generated automatically by the Continuum backend (requires pg_cron enabled in Supabase).
        </p>
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Push / email notifications:</p>
        <ComingSoonBadge />
      </div>
    </div>
  );
}

// ───── TAB: Language & Accessibility ─────────────────────────────
function LanguageTab({ user, caregiverProfile, reloadProfile }) {
  const [lang, setLang] = useState(caregiverProfile?.language || 'en');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    setLang(caregiverProfile?.language || 'en');
  }, [caregiverProfile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    setStatus({ type: '', message: '' });
    try {
      const { error } = await supabase
        .from('caregiver')
        .update({ language: lang, updated_at: new Date().toISOString() })
        .eq('caregiver_id', user.id);
      if (error) throw error;
      await reloadProfile();
      setStatus({ type: 'success', message: 'Language preference saved.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Language & Accessibility"
        subtitle="Choose your preferred language for the AI Assistant."
      />

      <StatusBanner type={status.type} message={status.message} />

      <form onSubmit={handleSave}>
        <div className="wt-form-group" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label>Preferred Language</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="wt-field-hint">This sets the default language for the AI Assistant. You can also change it per-session on the Assistant page.</p>
        </div>

        <button type="submit" className="wt-btn wt-btn--primary" disabled={saving}>
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Language'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Accessibility</h3>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
          <li>Screen reader support is provided by semantic HTML and ARIA labels throughout the app.</li>
          <li>High-contrast mode follows your system&apos;s OS-level settings.</li>
          <li>Keyboard navigation is supported for all interactive elements.</li>
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Font size & reduced motion controls:</p>
          <ComingSoonBadge />
        </div>
      </div>
    </div>
  );
}

// ───── TAB: Security ────────────────────────────────────────
function SecurityTab({ user, logout }) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (!window.confirm('Are you sure you want to sign out?')) return;
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Security & Sessions"
        subtitle="Manage your account security and active sessions."
      />

      {/* Session info */}
      <div style={{
        background: 'var(--surface-warm)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 20,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Current session</p>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
          <strong>Signed in as:</strong> {user?.email || 'Unknown'}
        </p>
        {user?.last_sign_in_at && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>Last sign-in:</strong> {formatDate(user.last_sign_in_at)}
          </p>
        )}
      </div>

      {/* Password */}
      <div style={{
        background: 'var(--background)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 20,
      }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>Password</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Password changes are handled through Supabase Auth. Use the &quot;Forgot Password&quot; link on the
          login page to reset your password securely.
        </p>
      </div>

      {/* Sign out */}
      <div style={{ marginBottom: 28 }}>
        <button
          className="wt-btn wt-btn--ghost"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
        >
          <LogOut size={15} />
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>

      {/* Danger zone */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 20px' }} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Danger Zone</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            disabled
            className="wt-btn"
            style={{
              opacity: 0.45, cursor: 'not-allowed',
              border: '1px solid var(--border-strong)', background: 'var(--surface)',
              color: 'var(--text-secondary)',
            }}
          >
            Delete Account
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Not yet available — contact support to delete your account.</p>
        </div>
      </div>
    </div>
  );
}

// ───── TAB: Care Circle ───────────────────────────────────────
function CareCircleTab({ patients }) {
  const navigate = useNavigate();

  return (
    <div>
      <SectionHeader
        title="Care Circle Membership"
        subtitle="Patients you are currently coordinating care for."
      />

      {patients.length === 0 ? (
        <div style={{
          background: 'var(--surface-warm)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center',
          color: 'var(--text-faint)', fontSize: 13,
        }}>
          <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.4, display: 'block' }} />
          You are not linked to any patients yet. Accept an invitation to join a care circle.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {patients.map((p) => (
            <div
              key={p.id}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: 'var(--text-primary)' }}>{p.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  {p.condition || 'No condition listed'}
                </p>
              </div>
              <button
                className="wt-btn wt-btn--ghost"
                style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={() => navigate('/care-circle')}
              >
                View Care Circle
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{
        background: 'var(--background)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '14px 18px',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          To manage care circle members, invitations, assigned responsibilities, and alert routing,
          visit the <strong>Care Circle</strong> page. Role changes, member removal, and invitations
          are only available to the primary caregiver.
        </p>
      </div>
    </div>
  );
}

// ───── MAIN COMPONENT ───────────────────────────────────────────
export default function SettingsPage() {
  const { user, caregiverProfile, reloadProfile, logout } = useAuth();
  const { patients } = usePatient();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="wt-dashboard">
      {/* Page header */}
      <div>
        <p className="wt-eyebrow">Account</p>
        <h1 className="wt-greeting__title" style={{ fontSize: 28 }}>Settings</h1>
        <p className="wt-greeting__sub">Manage your profile, preferences, and care circle membership.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Tab navigation */}
        <nav
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '8px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', border: 'none', borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'var(--primary-soft)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 400,
                  fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  transition: '0.15s',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '28px 32px',
          }}
        >
          {activeTab === 'profile' && (
            <ProfileTab user={user} caregiverProfile={caregiverProfile} reloadProfile={reloadProfile} />
          )}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'language' && (
            <LanguageTab user={user} caregiverProfile={caregiverProfile} reloadProfile={reloadProfile} />
          )}
          {activeTab === 'security' && <SecurityTab user={user} logout={logout} />}
          {activeTab === 'care-circle' && <CareCircleTab patients={patients} />}
        </div>
      </div>
    </div>
  );
}
