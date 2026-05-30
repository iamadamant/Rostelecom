let ORIGIN = 'https://rostelecom-production.up.railway.app/';

if (document.cookie.search("user") != -1) {
    document.location = '/routes.html'
}
let loginForm = document.getElementById("login-form");
loginForm.addEventListener("submit", handleLogin);
async function handleLogin(e) {
    e.preventDefault();
    e.stopPropagation();
    let remember = document.getElementById("remember-me").checked;
    let user = {
        "telephone": document.getElementById("login-tel").value,
        "password": document.getElementById("login-password").value
    }
    const response = await fetch(ORIGIN + 'api/login', {
        method: 'POST', // Specify the method
        headers: {
            'Content-Type': 'application/json' // Inform the server of the data format
        },
        body: JSON.stringify(user)
    });
    if (response.status == 200) {
        let token = await response.json();
        document.cookie = `user=${token}; path=/`;
        document.location = '/routes.html';
        let crewId = response.headers.get("x-user-crew");
        let userName = response.headers.get("x-user-name");
        if (crewId) {
            localStorage.setItem("crew_id", crewId);
        }
        if (userName) {
            localStorage.setItem("userName", decodeURIComponent(userName));
        }
    }
    let message = await response.json();
    if (message == "telephone") {
        document.getElementById("wrong-telephone").classList.remove("hidden");
    }
    if (message == "password") {
        document.getElementById("wrong-password").classList.remove("hidden");
    }
    console.log(message)
}