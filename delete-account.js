const API_URL = "https://nchisecapi-production.up.railway.app";

function showMessage(container, text, variant = 'info'){
  if(!container) return;
  container.innerHTML = `<div class="alert alert-${variant}" role="alert">${text}</div>`;
}

document.addEventListener('DOMContentLoaded', ()=>{
  // DELETE account form handler
  const deleteForm = document.getElementById('deleteAccountForm');
  if(deleteForm){
    deleteForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      try{
        const res = await fetch(`${API_URL}/auth/delete-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        alert(res.ok ? 'Your deletion request has been submitted.' : 'Unable to process request. Please try again.');
      }catch(err){
        console.error(err);
        alert('Network error — please try again later.');
      }
    });
  }

  // Password reset handling
  const params = new URLSearchParams(window.location.search);
  const tokenParam = params.get('token') || params.get('reset_token');
  const resetSection = document.getElementById('resetPasswordSection');
  const resetForm = document.getElementById('resetPasswordForm');
  const resetTokenInput = document.getElementById('resetToken');
  const resetMessage = document.getElementById('resetMessage');
  const submitBtn = document.getElementById('resetSubmitBtn');

  function showResetSection(token){
    if(!resetSection) return;
    resetTokenInput.value = token || '';
    resetSection.style.display = 'block';
    showMessage(resetMessage, 'Please enter a new password for your account.', 'info');
    const np = document.getElementById('newPassword');
    if(np) np.focus();
  }

  if(tokenParam){
    showResetSection(tokenParam);
  }

  if(resetForm){
    resetForm.addEventListener('submit', async e => {
      e.preventDefault();
      const token = resetTokenInput.value.trim();
      const password = document.getElementById('newPassword').value;
      const confirm = document.getElementById('confirmPassword').value;

      if(!token){ showMessage(resetMessage, 'No reset token provided.', 'danger'); return; }
      if(!password || password.length < 8){ showMessage(resetMessage, 'Password must be at least 8 characters.', 'warning'); return; }
      if(password !== confirm){ showMessage(resetMessage, 'Passwords do not match.', 'warning'); return; }

      submitBtn.disabled = true;
      showMessage(resetMessage, 'Submitting new password…', 'info');

      try{
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: password, confirmPassword: confirm })
        });

        if(res.ok){
          showMessage(resetMessage, 'Password updated successfully. You may now sign in with your new password.', 'success');
          // Optionally clear inputs
          resetForm.reset();
        }else{
          const data = await res.json().catch(()=>({}));
          const msg = data && data.message ? data.message : 'Unable to reset password. The token may be invalid or expired.';
          showMessage(resetMessage, msg, 'danger');
          submitBtn.disabled = false;
        }
      }catch(err){
        console.error(err);
        showMessage(resetMessage, 'Network error — please try again later.', 'danger');
        submitBtn.disabled = false;
      }
    });
  }

});
