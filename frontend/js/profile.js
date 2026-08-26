requireAuth();

document.getElementById('logoutBtn').onclick = logout;

let pendingPhoto; // undefined = unchanged, null = remove, string = new photo
const preview = document.getElementById('photoPreview');
const placeholder = preview.src;

// ---- load current profile ----
async function loadProfile() {
  const message = document.getElementById('message');
  try {
    const me = await api('/auth/me');
    document.getElementById('name').value = me.name || '';
    document.getElementById('registerNumber').value = me.registerNumber || '';
    document.getElementById('email').value = me.email || '';
    document.getElementById('department').value = me.department || '';
    document.getElementById('currentSemester').value = me.currentSemester || '';
    document.getElementById('college').value = me.college || '';
    if (me.photo) preview.src = me.photo;
  } catch (err) {
    message.style.color = '#d12f2f';
    message.textContent = err.message;
  }
}

// ---- compress a chosen image to a small JPEG data URL ----
function compressImage(file, maxDim = 512, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

document.getElementById('photoInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  const message = document.getElementById('message');
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    message.style.color = '#d12f2f';
    message.textContent = 'Please choose an image file.';
    return;
  }
  try {
    pendingPhoto = await compressImage(file);
    preview.src = pendingPhoto;
    message.textContent = '';
  } catch (err) {
    message.style.color = '#d12f2f';
    message.textContent = err.message;
  }
});

document.getElementById('removePhotoBtn').onclick = () => {
  pendingPhoto = null;
  preview.src = placeholder;
};

document.getElementById('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const message = document.getElementById('message');
  message.style.color = '';

  const payload = {
    name: document.getElementById('name').value.trim(),
    registerNumber: document.getElementById('registerNumber').value.trim(),
    email: document.getElementById('email').value.trim(),
    department: document.getElementById('department').value.trim(),
    currentSemester: document.getElementById('currentSemester').value.trim(),
    college: document.getElementById('college').value.trim()
  };
  if (pendingPhoto !== undefined) payload.photo = pendingPhoto; // string or null

  message.textContent = 'Saving...';
  try {
    await api('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });

    // Keep the cached user in sync (name/email used around the app).
    const user = getUser() || {};
    user.name = payload.name;
    user.email = payload.email;
    user.department = payload.department;
    localStorage.setItem('cgpa_user', JSON.stringify(user));

    message.style.color = '#16803c';
    message.textContent = 'Profile updated successfully.';
    pendingPhoto = undefined;
  } catch (err) {
    message.style.color = '#d12f2f';
    message.textContent = err.message;
  }
});

loadProfile();
