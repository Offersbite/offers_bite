import { useState } from 'react';
import { Brand, Icon } from '../../components/Brand.jsx';
import {
  loginAccount,
  registerAccount,
  resendEmailCode,
  verifyEmailCode,
} from '../../services/authApi.js';

export function AuthPage({ initialError = '', onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [stage, setStage] = useState('credentials');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const values = Object.fromEntries(new FormData(event.currentTarget));

    try {
      if (mode === 'register') {
        const result = await registerAccount({
          name: values.name,
          email: values.email,
          password: values.password,
        });
        setVerificationEmail(result.email || values.email.trim().toLowerCase());
        setStage('verification');
        setNotice('Your verification code is on its way.');
        return;
      }

      onAuthenticated(await loginAccount({
        email: values.email,
        password: values.password,
      }));
    } catch (requestError) {
      if (mode === 'login' && requestError.status === 403) {
        const email = String(values.email).trim().toLowerCase();
        setVerificationEmail(email);
        setStage('verification');
      }
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const code = new FormData(event.currentTarget).get('otp');
    try {
      onAuthenticated(await verifyEmailCode({ email: verificationEmail, otp: code }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await resendEmailCode(verificationEmail);
      setNotice(result.message || 'If verification is pending, a new code will be sent.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setStage('credentials');
    setError('');
    setNotice('');
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-story-top"><Brand inverse /></div>
        <div className="auth-story-content">
          <h1>Offers on the cards you own.</h1>
          <p className="auth-story-copy">
            Find eligible card offers before you spend.
          </p>

          <div className="auth-trust">
            <span><Icon name="lock" size={15} /> No card numbers. No CVV.</span>
          </div>
        </div>
        <div className="story-orb story-orb-one" />
        <div className="story-orb story-orb-two" />
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-form-wrap">
          {stage === 'verification' ? (
            <div className="auth-form-content">
              <button
                type="button"
                className="back-link"
                onClick={() => {
                  setStage('credentials');
                  setMode('register');
                  setError('');
                  setNotice('');
                }}
              >
                <span aria-hidden="true">←</span> Back to sign up
              </button>
              <div className="auth-icon"><Icon name="mail" size={23} /></div>
              <h2>Verify your email</h2>
              <p className="auth-form-intro">
                Enter the 4-digit code sent to <strong>{verificationEmail}</strong>.
              </p>
              <Notice error={error} notice={notice} />
              <form onSubmit={handleVerify} className="auth-form">
                <label htmlFor="otp">Verification code</label>
                <input
                  className="otp-input"
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  autoComplete="one-time-code"
                  maxLength="4"
                  placeholder="0000"
                  autoFocus
                  required
                />
                <button className="button button-primary button-full" disabled={busy}>
                  {busy ? 'Checking code…' : 'Verify email'} <Icon name="chevron" size={17} />
                </button>
              </form>
              <div className="resend-row">
                <span>Didn’t get the email?</span>
                <button type="button" onClick={handleResend} disabled={busy}>Send a new code</button>
              </div>
              <p className="fine-print">Code expires in 10 minutes.</p>
            </div>
          ) : (
            <div className="auth-form-content">
              <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
              <div className="auth-tabs" role="tablist" aria-label="Account access">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => changeMode('login')}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  className={mode === 'register' ? 'active' : ''}
                  onClick={() => changeMode('register')}
                >
                  Create account
                </button>
              </div>
              <Notice error={error} notice={notice} />
              <form onSubmit={handleSubmit} className="auth-form">
                {mode === 'register' && (
                  <div className="field">
                    <label htmlFor="name">Your name</label>
                    <input id="name" name="name" autoComplete="name" placeholder="Name" maxLength="100" required />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <div className="input-with-icon">
                    <Icon name="mail" size={17} />
                    <input id="email" name="email" type="email" autoComplete="email" placeholder="Email address" maxLength="100" required />
                  </div>
                </div>
                <div className="field">
                  <div className="label-row">
                    <label htmlFor="password">Password</label>
                  </div>
                  <div className="input-with-icon">
                    <Icon name="lock" size={17} />
                    <input id="password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Password' : 'At least 8 characters'} minLength={mode === 'register' ? 8 : 1} maxLength="128" required />
                  </div>
                </div>
                <button className="button button-primary button-full" disabled={busy}>
                  {busy
                    ? 'One moment…'
                    : mode === 'login'
                      ? 'Sign in to OffersBite'
                      : 'Create account & verify email'}
                  <Icon name="chevron" size={17} />
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Notice({ error, notice }) {
  if (error) return <div className="notice notice-error" role="alert">{error}</div>;
  if (notice) return <div className="notice notice-success" role="status">{notice}</div>;
  return null;
}
