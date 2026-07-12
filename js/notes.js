import { apiFetch } from './api.js';

const addBtn = document.getElementById('addnoteBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput'); 
const notesList = document.getElementById('noteList');
const logoutBtn = document.getElementById('logoutBtn');
const emptyStateList = document.getElementById('emptyState');
const errorEl = document.getElementById('errorMessage');

const toastBanner = document.getElementById('notification-toast');
const toastMessage = document.getElementById('notification-message');
    
function showError(message){
    if(message){
        errorEl.textContent = message;
        errorEl.style.display = "block";
    }
    else{
        errorEl.textContent = "";
        errorEl.style.display = "none";
    }
}

function checkTokenExpiry(error) {
    if (error && error.message === 'Invalid or expired token') {
        localStorage.clear();
        window.location.href = './index.html'; 
        return true;
    }
    return false;
}

function setFormEnabled(enabled) {
    noteInput.disabled = !enabled;
    if (fileInput) fileInput.disabled = !enabled; 
    addBtn.disabled = !enabled;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

document.addEventListener('DOMContentLoaded', async() => {
    const token = localStorage.getItem('token');

    if(!token){
        window.location.href= './index.html';
        return;
    }
    logoutBtn.addEventListener("click", handleLogout);
    addBtn.addEventListener("click", handleAddNote);
    await fetchAndLoadNotes();
});

async function fetchAndLoadNotes() {
    try {
        const response = await apiFetch('api/notes', { method: "GET" });
        
        let notesArray = [];
        if (response && response.success === true && Array.isArray(response.data)) {
            notesArray = response.data;
        } else if (response && Array.isArray(response.data)) {
            notesArray = response.data;
        } else if (Array.isArray(response)) {
            notesArray = response;
        }

        displayNotes(notesArray); 
    } catch(error) {
        if (!checkTokenExpiry(error)) {
            showError('Failed to load notes. Please try again.');
        }
    }
}

async function displayNotes(notesArray){
    notesList.innerHTML = "";
    
    if (!notesArray || notesArray.length === 0) {
        emptyStateList.style.display = "block";
        return;
    }
    emptyStateList.style.display = "none";

    notesArray.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        
        const currentId = note._id; 
        if (currentId) {
            noteItem.setAttribute('data-id', currentId);
        }

        const textEl = document.createElement('p');
        textEl.className = 'note-text';
        textEl.textContent = note.text; 
        noteItem.appendChild(textEl);

        if (note.imageUrl) {
            const imgEl = document.createElement('img');
            imgEl.className = 'note-img';
            imgEl.src = note.imageUrl;
            imgEl.alt = "Attached visual note element";
            noteItem.appendChild(imgEl);
        }

        const dateEl = document.createElement('span');
        dateEl.className = 'note-date';
        const parsedDate = note.createdAt ? new Date(note.createdAt) : new Date();
        dateEl.textContent = parsedDate.toLocaleString();
        noteItem.appendChild(dateEl);

        const deleteEl = document.createElement('p');
        deleteEl.className = 'note-del';
        deleteEl.textContent = "DELETE";

        deleteEl.addEventListener('click', () => {
            if (currentId) {
                handleDeleteNote(currentId);
            } else {
                console.error("Visual item missing reference ID context mapping", note);
            }
        });

        noteItem.appendChild(deleteEl);
        notesList.appendChild(noteItem);
    });
}

async function handleAddNote() {
    showError("");
    const noteText = noteInput.value.trim();

    if (!noteText || noteText.length < 2) {
        showError("Please enter text content for your note (minimum 2 characters).");
        noteInput.focus();
        return;
    }
    
    setFormEnabled(false);

    try {
        let uploadedImageUrl = "";

        if (fileInput && fileInput.files && fileInput.files) {
            const formData = new FormData();
            formData.append('image', fileInput.files);

            const uploadResponse = await apiFetch('api/notes/upload', {
                method: 'POST',
                body: formData 
            });
            uploadedImageUrl = uploadResponse.imageUrl;
            localStorage.setItem('userImageURL', uploadedImageUrl);
        }

        await apiFetch('api/notes', {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body : JSON.stringify({ 
                text : noteText,
                imageUrl: uploadedImageUrl 
            }) 
        });

        noteInput.value = "";
        if (fileInput) fileInput.value = ""; 
        
        await delay(150); 
        await fetchAndLoadNotes();
    } catch(error) {
        if (!checkTokenExpiry(error)) {
            showError(error.message || "Failed to save the note.");
        }
    } finally {
        setFormEnabled(true);
        noteInput.focus();
    }
} 

function handleLogout(){
    localStorage.clear();
    window.location.href = './index.html';
}

async function handleDeleteNote(noteId){
    if(!noteId) return;
    
    try {
        await apiFetch(`api/notes/${noteId}` , { method: "DELETE" });
        
        await delay(150); 
        await fetchAndLoadNotes(); 
    } catch(error) {
        if (!checkTokenExpiry(error)) {
            showError('Failed to delete note.'); 
        }
    }
}
