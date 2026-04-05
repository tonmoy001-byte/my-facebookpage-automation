document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('draftForm');
  const topicInput = document.getElementById('topic');
  const imageFileInput = document.getElementById('imageFiles');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const imageGallery = document.getElementById('imageGallery');
  
  const generateBtn = document.getElementById('generateBtn');
  const generateText = generateBtn.querySelector('.btn-text');
  const generateSpinner = document.getElementById('loadingSpinner');
  
  const previewSection = document.getElementById('previewSection');
  const previewCaption = document.getElementById('previewCaption');
  const previewImageBox = document.getElementById('previewImageBox');
  
  const discardBtn = document.getElementById('discardBtn');
  const publishBtn = document.getElementById('publishBtn');
  const publishText = publishBtn.querySelector('.btn-text');
  const publishSpinner = document.getElementById('publishSpinner');
  
  const statusMessage = document.getElementById('statusMessage');

  // Aesthetic update for file name selection
  imageFileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      if (files.length > 4) {
        alert('You can only upload a maximum of 4 images.');
        imageFileInput.value = '';
        fileNameDisplay.textContent = 'Choose up to 4 images...';
        fileNameDisplay.classList.remove('selected');
        return;
      }
      fileNameDisplay.textContent = `${files.length} file(s) selected`;
      fileNameDisplay.classList.add('selected');
    } else {
      fileNameDisplay.textContent = 'Choose up to 4 images...';
      fileNameDisplay.classList.remove('selected');
    }
  });

  // Request Draft
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const topic = topicInput.value.trim();
    const file = imageFileInput.files[0];
    if(!topic) return;

    // Transition to loading
    generateBtn.disabled = true;
    generateText.textContent = "Generating...";
    generateSpinner.classList.remove('hidden');
    previewSection.classList.add('disabled');
    statusMessage.classList.add('hidden');

    // Build the Multi-Part Form Data payload
    const formData = new FormData();
    formData.append('topic', topic);
    
    // Append multiple files
    for (const file of imageFileInput.files) {
      formData.append('imageFiles', file);
    }

    try {
      // NOTE: We don't specify 'Content-Type' when uploading FormData natively!
      const response = await fetch('/api/draft', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to generate draft.');

      // Presentation logic
      previewCaption.value = data.caption;
      
      // Store the server's local file paths globally so publishBtn can use it natively
      window.draftLocalFilePaths = data.localFilePaths || [];

      if (data.imageUrls && data.imageUrls.length > 0) {
        // Clear previous and render the new image preview gallery
        imageGallery.innerHTML = '';
        imageGallery.setAttribute('data-count', data.imageUrls.length);
        
        data.imageUrls.forEach(url => {
          const item = document.createElement('div');
          item.className = 'gallery-item';
          const img = document.createElement('img');
          img.src = url;
          item.appendChild(img);
          imageGallery.appendChild(item);
        });

        previewImageBox.classList.remove('hidden');
      } else {
        previewImageBox.classList.add('hidden');
        imageGallery.innerHTML = '';
      }

      previewSection.classList.remove('disabled');

    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      generateBtn.disabled = false;
      generateText.textContent = "Generate AI Draft";
      generateSpinner.classList.add('hidden');
    }
  });

  // Discard function
  discardBtn.addEventListener('click', () => {
    previewSection.classList.add('disabled');
    previewCaption.value = '';
    imageGallery.innerHTML = '';
    topicInput.value = '';
    imageFileInput.value = '';
    fileNameDisplay.textContent = 'Choose up to 4 images...';
    fileNameDisplay.classList.remove('selected');
    statusMessage.classList.add('hidden');
    window.draftLocalFilePaths = [];
  });

  // Publish function
  publishBtn.addEventListener('click', async () => {
    const finalCaption = previewCaption.value.trim();
    const localFilePath = window.draftLocalFilePath;

    if (!finalCaption) {
      showStatus('Caption cannot be empty.', 'error');
      return;
    }

    // Publish loading state
    publishBtn.disabled = true;
    publishText.textContent = "Publishing...";
    publishSpinner.classList.remove('hidden');
    statusMessage.classList.add('hidden');
    discardBtn.disabled = true;

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: finalCaption,
          localFilePaths: window.draftLocalFilePaths
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to publish.');

      // Success
      showStatus('Successfully Published to Facebook! 🎉 ID: ' + data.id, 'success');
      
      setTimeout(() => {
        discardBtn.click(); // Reset layout for next post
      }, 4000);

    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      publishBtn.disabled = false;
      publishText.textContent = "Publish to Facebook";
      publishSpinner.classList.add('hidden');
      discardBtn.disabled = false;
    }
  });

  function showStatus(msg, type) {
    statusMessage.textContent = msg;
    statusMessage.className = `status ${type}`; 
  }
});
