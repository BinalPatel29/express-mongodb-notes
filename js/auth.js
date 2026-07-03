import { apiFetch } from './api.js';

const registerForm = document.getElementById("registerForm");
if (registerForm) {
    const firstNameInput = document.getElementById("fname");
    const lastNameInput = document.getElementById("lname");
    const emailInput = document.getElementById("email");
    const passInput = document.getElementById("password");
    const mobileNoInput = document.getElementById('mobno');
    const errorDiv = document.getElementById("errorMessage");
    const successDiv = document.getElementById("successMessage");

    async function handlerRegister(event) {
        event.preventDefault();
        
        errorDiv.textContent = "";
        errorDiv.style.display = "none";
        successDiv.textContent = "";
        successDiv.style.display = "none";

        const payload = { 
            firstName: firstNameInput.value,
            lastName: lastNameInput.value,
            email: emailInput.value, 
            password: passInput.value
        };

        if (mobileNoInput.value.trim() !== "") {
            payload.mobileNo = mobileNoInput.value.trim();
        }

        try {
            const response = await apiFetch('/api/auth/register', { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify(payload) 
            });

            if (response && response.token) {
                localStorage.setItem("token", response.token);
                successDiv.textContent = "Registration successful! Redirecting to notes...";
                successDiv.style.display = "block";
                
                setTimeout(() => {
                    window.location.href = "notes.html";
                }, 1500);
            } else {
                successDiv.textContent = "Account created successfully! Redirecting to login...";
                successDiv.style.display = "block";
                
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1500);
            }
        } catch (error) {
            errorDiv.textContent = error.message || "An unexpected error occurred during registration.";
            errorDiv.style.display = "block";
        }
    }

    registerForm.addEventListener("submit", handlerRegister);
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    const emailInput = document.getElementById("email");
    const passInput = document.getElementById("password");
    const errorDiv = document.getElementById("errorMessage");
    const successDiv = document.getElementById("successMessage");

    async function handlerLogin(event) {
        event.preventDefault();
        
        errorDiv.textContent = "";
        errorDiv.style.display = "none";
        successDiv.textContent = "";
        successDiv.style.display = "none";

        const payload = { 
            email: emailInput.value, 
            password: passInput.value 
        };

        try {
            const response = await apiFetch('/api/auth/login', { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify(payload) 
            });

            if (response && response.token) {
                localStorage.setItem("token", response.token);
                successDiv.textContent = "Login successful! Redirecting to notes..."; 
                successDiv.style.display = "block";
                
                setTimeout(() => {
                    window.location.href = "notes.html";
                }, 1500);
            } else {
                throw new Error(response?.message || "Invalid credentials or no token received.");
            }
        } catch (error) {
            errorDiv.textContent = error.message || "An unexpected error occurred.";
            errorDiv.style.display = "block";
        }
    }

    loginForm.addEventListener("submit", handlerLogin);
}