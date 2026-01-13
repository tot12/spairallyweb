const API_URL ="https://nchisecapi-production.up.railway.app";


document.getElementById("deleteAccountForm").addEventListener("submit", async e => {
  e.preventDefault();

  const email = document.getElementById("email").value;

  const res = await fetch(`${API_URL}/auth/delete-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  alert(
    res.ok
      ? "Your deletion request has been submitted."
      : "Unable to process request. Please try again."
  );
});
