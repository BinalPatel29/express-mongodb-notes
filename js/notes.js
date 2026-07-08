import { apiFetch } from './api.js';

const addBtn = document.getElementById('addnoteBtn');
const noteInput = document.getElementById('noteInput');
const fileInput = document.getElementById('fileInput'); 
const notesList = document.getElementById('noteList');
const logoutBtn = document.getElementById('logoutBtn');
const emptyStateList = document.getElementById('emptyState');
const errorEl = document.getElementById('errorMessage');

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
        window.location.href = '/frontend/index.html';
        return true;
    }
    return false;
}

function setFormEnabled(enabled) {
    noteInput.disabled = !enabled;
    fileInput.disabled = !enabled; // Handle file input state
    addBtn.disabled = !enabled;
}

document.addEventListener('DOMContentLoaded', async() => {
    const token = localStorage.getItem('token');

    if(!token){
        window.location.href= '/frontend/index.html';
        return;
    }
    logoutBtn.addEventListener("click", handleLogout);
    addBtn.addEventListener("click", handleAddNote);
    await fetchAndLoadNotes();
});

async function fetchAndLoadNotes() {
    try{
        const notes = await apiFetch('/api/notes', {
            method: "GET"
        });
        displayNotes(notes); 
    }
    catch(error){
        if (!checkTokenExpiry(error)) {
            showError('Failed to load notes. Please try again.');
        }
    }
}

async function displayNotes(notesArray){
    notesList.innerHTML="";
    if(!notesArray || notesArray.length === 0){
        emptyStateList.style.display= "block";
        return;
    }
    emptyStateList.style.display= "none";

    notesArray.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';

        const textEl = document.createElement('p');
        textEl.className = 'note-text';
        textEl.textContent = note.text; 

        if (note.imageUrl) {
            const imgEl = document.createElement('img');
            imgEl.className = 'note-img';
            imgEl.src = note.imageUrl;
            imgEl.alt = "Uploaded image attachment";
            imgEl.style.maxWidth = "200px"; 
            noteItem.appendChild(imgEl);
        }

        const dateEl = document.createElement('span');
        dateEl.className = 'note-date';
        const parsedDate = note.createdAt ? new Date(note.createdAt) : new Date();
        const isValidDate = parsedDate instanceof Date && !isNaN(parsedDate)
        dateEl.textContent = isValidDate ? parsedDate.toLocaleString() : new Date().toLocaleString();

        const deleteEl = document.createElement('p');
        deleteEl.className = 'note-del';
        deleteEl.textContent = "DELETE";

        deleteEl.addEventListener('click', () => {
            handleDeleteNote(note._id || note.id); 
        });

        noteItem.appendChild(textEl);
        noteItem.appendChild(dateEl);
        deleteEl && noteItem.appendChild(deleteEl);
        notesList.appendChild(noteItem);
    });
}

async function handleAddNote() {
    showError("");
    const noteText = noteInput.value.trim();

    if(!noteText){
        showError("Note cannot be empty.");
        noteInput.focus();
        return;
    }
    setFormEnabled(false);

    try {
        let uploadedImageUrl = "";

        if (fileInput.files && fileInput.files[0]) {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);

            const uploadResponse = await apiFetch('/api/upload', {
                method: 'POST',
                body: formData 
            });

            uploadedImageUrl = uploadResponse.imageUrl;
            
            localStorage.setItem('lastUploadedImageURL', uploadedImageUrl);
        }

        await apiFetch('/api/notes', {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body : JSON.stringify({ 
                text : noteText,
                imageUrl: uploadedImageUrl 
            }) 
        });

        noteInput.value = "";
        fileInput.value = ""; 
        await fetchAndLoadNotes();
    }
    catch(error){
        if (!checkTokenExpiry(error)) {
            showError(error.message || "Failed to save the note.");
        }
    }
    finally{
        setFormEnabled(true);
        noteInput.focus();
    }
} 

function handleLogout(){
    localStorage.clear(); 
    window.location.href = '/frontend/index.html';
}

async function handleDeleteNote(noteId){
    if(!noteId) return;
    try{
        await apiFetch(`/api/notes/${noteId}` ,{
            method: "DELETE"
        });
        await fetchAndLoadNotes();
    }
    catch(error){
        if (!checkTokenExpiry(error)) {
            showError('Failed to delete note.'); 
        }
    }
}
