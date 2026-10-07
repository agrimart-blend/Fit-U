const parameters = new URLSearchParams(location.search);
const code = parameters.get('oobCode');
const mode = parameters.get('mode');
// Do not leave the one-time code in the browser URL or forward it to other links.
history.replaceState(null, '', location.pathname);
const heading = document.getElementById('heading');
const status = document.getElementById('status');
const form = document.getElementById('reset-form');
const action = document.getElementById('action');
const finish = document.getElementById('finish');
const password = document.getElementById('password');
const confirm = document.getElementById('confirm');
const error = document.getElementById('error');
const submit = document.getElementById('submit');
let locked = false;
const explain = e => {
  if (['auth/expired-action-code','auth/invalid-action-code'].includes(e?.code)) return 'This link has expired or was already used. Request a new email in Fit U.';
  if (e?.code === 'auth/weak-password' || e?.code === 'auth/password-does-not-meet-requirements') return 'Choose a stronger password that meets your account’s password requirements.';
  if (e?.code === 'auth/user-disabled') return 'This account is disabled. Return to Fit U for help.';
  return 'We couldn’t complete this step. Check your connection and reopen the email link to try again.';
};
const success = (title, message) => { heading.textContent = title; status.textContent = message; form.hidden = true; action.hidden = true; finish.hidden = false; password.value = ''; confirm.value = ''; };
document.getElementById('show-password').addEventListener('click', event => {
  const reveal = password.type === 'password';
  password.type = confirm.type = reveal ? 'text' : 'password';
  event.currentTarget.textContent = reveal ? 'Hide' : 'Show';
  event.currentTarget.setAttribute('aria-label', reveal ? 'Hide passwords' : 'Show passwords');
});
if (code && ['resetPassword','verifyEmail','recoverEmail','verifyAndChangeEmail'].includes(mode)) {
  status.textContent = 'Checking your secure link…';
  try {
    const [{ initializeApp }, sdk, config] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'),
      fetch('auth-config.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error('Configuration unavailable'); return response.json(); })
    ]);
    // Use only our fixed project configuration, never apiKey/redirect values from the URL.
    const auth = sdk.initializeAuth(initializeApp(config), { persistence: sdk.inMemoryPersistence });
    if (mode === 'resetPassword') {
      const email = await sdk.verifyPasswordResetCode(auth, code);
      heading.textContent = 'Your next fresh start.';
      status.textContent = `Choose a new Fit U password for ${email}.`;
      form.hidden = false;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (locked) return;
        error.textContent = '';
        if (password.value.length < 8) { error.textContent = 'Use at least 8 characters.'; password.focus(); return; }
        if (password.value !== confirm.value) { error.textContent = 'Your passwords don’t match yet.'; confirm.focus(); return; }
        locked = true; submit.disabled = true; password.disabled = confirm.disabled = true;
        try { await sdk.confirmPasswordReset(auth, code, password.value); success('Password updated.', 'Your new password is ready. Return to Fit U and sign in.'); }
        catch (e) { error.textContent = explain(e); }
        finally { locked = false; submit.disabled = false; password.disabled = confirm.disabled = false; }
      });
    } else {
      await sdk.checkActionCode(auth, code);
      const recovery = mode === 'recoverEmail';
      heading.textContent = recovery ? 'Restore your email.' : mode === 'verifyAndChangeEmail' ? 'Confirm your new email.' : 'One last step.';
      status.textContent = recovery ? 'Restore the previous email address on your Fit U account. If you didn’t request the change, reset your password in the app afterward.' : 'Confirm this email address for your Fit U account.';
      action.textContent = recovery ? 'Restore email address' : 'Verify email address';
      action.hidden = false;
      action.addEventListener('click', async () => {
        if (locked) return;
        locked = true; action.disabled = true;
        try { await sdk.applyActionCode(auth, code); success(recovery ? 'Email restored.' : 'Email verified.', recovery ? 'Your previous account email has been restored. Return to Fit U to secure your account.' : 'You’re ready to continue. Return to Fit U.'); }
        catch (e) { status.textContent = explain(e); }
        finally { locked = false; action.disabled = false; }
      });
    }
  } catch (e) { heading.textContent = 'Let’s try a fresh link.'; status.textContent = explain(e); }
} else if (code || mode) {
  heading.textContent = 'Link not supported.';
  status.textContent = 'Request a new verification or password-reset email from Fit U.';
}
