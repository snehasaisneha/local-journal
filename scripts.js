document.addEventListener('DOMContentLoaded', function () {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    // Load saved S3 configuration from localStorage
    loadS3Config();

    // Photo preview functionality
    const photoInput = document.getElementById('photoWorthyMoment');
    const previewContainer = document.getElementById('photoWorthyMoment-preview');

    photoInput.addEventListener('change', function (event) {
        const file = event.target.files[0];

        // Clear previous preview
        previewContainer.innerHTML = '';

        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.maxWidth = '300px';
                img.style.maxHeight = '300px';
                img.style.border = '1px solid #ddd';
                img.style.borderRadius = '4px';
                img.style.marginTop = '10px';

                // Add remove button
                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Remove Photo';
                removeBtn.type = 'button';
                removeBtn.style.marginLeft = '10px';
                removeBtn.style.backgroundColor = '#ff4d4d';
                removeBtn.style.color = 'white';
                removeBtn.style.border = 'none';
                removeBtn.style.padding = '5px 10px';
                removeBtn.style.borderRadius = '4px';
                removeBtn.style.cursor = 'pointer';

                removeBtn.onclick = function () {
                    photoInput.value = '';
                    previewContainer.innerHTML = '';
                };

                previewContainer.appendChild(img);
                previewContainer.appendChild(removeBtn);
            };

            reader.readAsDataURL(file);
        }
    });
});

// Local Storage Functions
function saveS3Presets() {
    const bucketName = document.getElementById('bucketName').value;
    const s3Folder = document.getElementById('s3Folder').value;

    localStorage.setItem('s3BucketName', bucketName);
    localStorage.setItem('s3Folder', s3Folder);
}

function loadS3Presets() {
    const savedBucket = localStorage.getItem('s3BucketName');
    const savedFolder = localStorage.getItem('s3Folder');

    if (savedBucket) {
        document.getElementById('bucketName').value = savedBucket;
    }

    if (savedFolder) {
        document.getElementById('s3Folder').value = savedFolder;
    }
}

function clearS3Presets() {
    localStorage.removeItem('s3BucketName');
    localStorage.removeItem('s3Folder');

    // Clear the form fields
    document.getElementById('bucketName').value = '';
    document.getElementById('s3Folder').value = '';

    // Show confirmation
    document.getElementById('status').innerHTML =
        '🗑️ <strong>Local data cleared</strong><br>Bucket name and folder have been removed from browser storage.';

    // Clear status after 3 seconds
    setTimeout(() => {
        document.getElementById('status').innerHTML = '';
    }, 3000);
}

// Add event listeners for saving and clearing data
document.addEventListener('DOMContentLoaded', function () {

    // Save S3 config when fields change
    document.getElementById('bucketName').addEventListener('input', saveS3Presets);
    document.getElementById('s3Folder').addEventListener('input', saveS3Presets);

    // Clear local data button
    document.getElementById('clear-local-data').addEventListener('click', clearS3Presets);
});

document.addEventListener('DOMContentLoaded', function () {
    // Load S3 presets
    loadS3Presets();
});

document.getElementById('upload-button').onclick = function () {

    saveS3Presets();

    AWS.config.update({
        accessKeyId: document.getElementById('accessKeyId').value,
        secretAccessKey: document.getElementById('secretAccessKey').value,
        region: document.getElementById('region').value
    });

    const s3 = new AWS.S3();
    const bucketName = document.getElementById('bucketName').value;
    const s3Folder = document.getElementById('s3Folder').value.trim();

    // Get all form data
    const date = document.getElementById('date').value;
    const storyWorthyMoment = document.getElementById('storyWorthyMoment').value;
    const selectedMood = document.querySelector('input[name="mood"]:checked');
    const file = document.getElementById('photoWorthyMoment').files[0];

    // Validation
    if (!date || !storyWorthyMoment || !selectedMood) {
        document.getElementById('status').innerHTML = '❌ <strong>Missing required fields</strong><br>Please fill in date, story, and mood.';
        return;
    }

    // Create timestamp and random component for uniqueness
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    const randomId = Math.random().toString(36).substr(2, 6); // Shorter random string

    // Get device name (basic detection)
    const getDeviceName = () => {
        const userAgent = navigator.userAgent;
        if (/iPhone/i.test(userAgent)) return 'iPhone';
        if (/iPad/i.test(userAgent)) return 'iPad';
        if (/Android/i.test(userAgent)) return 'Android';
        if (/Mac/i.test(userAgent)) return 'Mac';
        if (/Windows/i.test(userAgent)) return 'Windows';
        return 'Unknown Device';
    };

    // Helper function to create S3 key with folder
    const createS3Key = (filename, isStatic = false) => {
        let basePath = '';

        if (s3Folder) {
            // Ensure folder doesn't start/end with slashes
            const cleanFolder = s3Folder.replace(/^\/+|\/+$/g, '');
            basePath = cleanFolder;
        }

        if (isStatic) {
            // Add static subfolder for images
            basePath = basePath ? `${basePath}/static` : 'static';
        }

        return basePath ? `${basePath}/${filename}` : filename;
    };

    // Create simple photo filename with just random string
    let photoS3Path = null;
    let photoDisplayName = null;

    if (file) {
        // Create filename: randomid_originalname
        const photoFileName = `${randomId}_${file.name}`;
        photoDisplayName = file.name; // Keep original name for display
        // S3 path includes the static folder
        photoS3Path = createS3Key(photoFileName, true);
    }


    // Create JSON data with proper photo reference
    const journalData = {
        date: date,
        timestamp: timestamp,
        storyWorthyMoment: storyWorthyMoment,
        photoWorthyMoment: photoS3Path, // Full S3 path including static folder
        mood: parseInt(selectedMood.value),
        device: getDeviceName()
    };

    // Simple JSON filename - just date (no random ID for single user)
    const jsonFileName = `journal_${date}.json`;

    // Convert JSON to blob
    const jsonBlob = new Blob([JSON.stringify(journalData, null, 2)], {
        type: 'application/json'
    });

    let uploadCount = 0;
    let totalUploads = file ? 2 : 1; // Upload JSON + photo (if exists)
    let errors = [];
    let successMessages = [];

    const checkComplete = () => {
        uploadCount++;
        if (uploadCount === totalUploads) {
            if (errors.length === 0) {
                const folderInfo = s3Folder ? `<br><strong>Location:</strong> ${s3Folder}/` : '<br><strong>Location:</strong> Root folder';
                const successList = successMessages.join('<br>');
                document.getElementById('status').innerHTML =
                    `✅ <strong>Upload Successful!</strong>${folderInfo}<br><br>${successList}`;
            } else {
                const errorList = errors.map(err => `• ${err}`).join('<br>');
                const successList = successMessages.length > 0 ?
                    `<br><br><strong>Successful:</strong><br>${successMessages.join('<br>')}` : '';
                document.getElementById('status').innerHTML =
                    `❌ <strong>Upload completed with errors:</strong><br><br>${errorList}${successList}`;
            }
        }
    };

    // Upload JSON file (goes to main folder, not static)
    const jsonParams = {
        Bucket: bucketName,
        Key: createS3Key(jsonFileName, false), // JSON goes to main folder
        Body: jsonBlob,
        ContentType: 'application/json'
    };

    const folderInfo = s3Folder ? ` to ${s3Folder}/` : '';
    document.getElementById('status').innerHTML = `📤 Uploading journal entry${folderInfo}...`;

    s3.upload(jsonParams, function (err, data) {
        if (err) {
            errors.push(`Journal data upload failed: ${err.message}`);
        } else {
            console.log('JSON uploaded successfully:', data.Location);
            successMessages.push('📄 Journal data saved');
        }
        checkComplete();
    });

    // Upload photo if exists (goes to static subfolder)
    if (file) {
        const photoParams = {
            Bucket: bucketName,
            Key: photoS3Path, // Already includes static folder path
            Body: file,
            ContentType: file.type
        };

        s3.upload(photoParams, function (err, data) {
            if (err) {
                errors.push(`Photo upload failed: ${err.message}`);
            } else {
                console.log('Photo uploaded successfully:', data.Location);
                successMessages.push(`📸 Photo saved: ${photoDisplayName}`);
            }
            checkComplete();
        });
    }
}