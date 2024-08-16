/**
 * Copyright 2023 Adobe
 * All Rights Reserved.
 *
 * NOTICE: Adobe permits you to use, modify, and distribute this file in
 * accordance with the terms of the Adobe license agreement accompanying
 * it.
 */

// gather all the elements we need
const gallery = document.querySelector(".gallery");
const popup = document.querySelector(".popup");
const title = popup.querySelector(".title");
const signer = popup.querySelector(".signer");
const time = popup.querySelector(".time");
const producer = popup.querySelector(".producer");
const fileInput = document.getElementById('files');
const previewContainer = document.createElement('div');
previewContainer.classList.add('preview-container', 'mt-4');

// Initialize intl-tel-input
const phoneInputField = document.querySelector("#mobileNumber");
const phoneInput = window.intlTelInput(phoneInputField, {
    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
    separateDialCode: true,
    preferredCountries: ["us", "in", "gb", "ca"]
});

// Add an image to the gallery
function addGalleryItem(data) {
    const galleryItem = document.createElement('div');
    galleryItem.classList.add('container', 'relative');

    var img = document.createElement('img');
    img.src = data.url;
    img.classList.add("image", "w-full", "h-auto");
    galleryItem.appendChild(img);

    const badge = document.createElement('img');
    badge.src = "badge.svg";
    badge.classList.add("badge");
    galleryItem.appendChild(badge);

    const downloadBtn = document.createElement('a');
    downloadBtn.href = data.url;
    downloadBtn.download = data.name;
    downloadBtn.classList.add('absolute', 'bottom-2', 'right-2', 'bg-blue-500', 'text-white', 'px-2', 'py-1', 'rounded');
    downloadBtn.textContent = 'Download';
    galleryItem.appendChild(downloadBtn);

    gallery.appendChild(galleryItem);

    // add popup event listeners
    badge.addEventListener("mouseenter", function() {
        const rect = badge.getBoundingClientRect();

        const report = data.report;

        // get the active manifest
        const manifest = report.manifests[report.active_manifest];

        // show the title of the manifest, or the name of the image
        title.textContent = manifest.title || data.name;

        // show the issuer and time of the signature
        const issuer = manifest.signature_info?.issuer || "";
        signer.innerHTML = `Signed By: ${issuer}`;

        const sign_time = manifest.signature_info?.time;
        // convert ISO-8601 sign_time to local time
        const date = sign_time ? new Date(sign_time).toLocaleString() : "";
        time.innerHTML = sign_time ? `Signed On: ${date}` : "";

        // truncate the claim generator at first space for first token
        // and then replace underscores and forward slash with spaces
        const generator = manifest.claim_generator?.split(" ")[0].replace(/[_/]/g, " ")
        producer.innerHTML = `Produced With: ${generator}`;

        // Position the popup and show it
        popup.style.display = "block";
        popup.style.top = `${rect.top + window.scrollY}px`;
        const popupWidth = popup.getBoundingClientRect().width;
        popup.style.left = `${rect.left > popupWidth ? rect.left - popupWidth : rect.left + rect.width}px`;
    });
    
    badge.addEventListener("mouseleave", function() {
        // hide the popup
        popup.style.display = "none";
    });
}

// Function to preview the selected file
function previewFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        previewContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = e.target.result;
        img.classList.add('preview-image', 'max-w-full', 'h-auto', 'mt-4');
        previewContainer.appendChild(img);
    }
    reader.readAsDataURL(file);
}

// Function to handle file upload
function handleFileUpload(file) {
    // reset the container
    gallery.innerHTML = ""; 

    // Get user information
    const name = document.getElementById('name').value;
    const phoneNumber = phoneInput.getNumber();
    // mobile number without country code
    const country = phoneInput.getSelectedCountryData();
    const countryCode = country.dialCode;
    const countryName = country.name;
    const mobileNumber = phoneNumber.replace(`+${countryCode}`, '');

    let fileName = file.name;
    const reader = new FileReader();

    // post the file to our server
    reader.addEventListener('load', async (event) => {
        try {
            let url = `http://localhost:8000/upload?name=${fileName}`
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    file: Array.from(new Uint8Array(event.target.result)),
                    name,
                    fileName,
                    countryName,
                    countryCode,
                    mobileNumber
                })
            });

            let body = await response.json()

            // add the returned image data to the gallery
            addGalleryItem(body);
        }
        catch (err) {
            console.log(err)
        }
    });

    reader.readAsArrayBuffer(file);
}

// Handle file input change event
fileInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        const file = event.target.files[0];
        previewFile(file);
    } else {
        previewContainer.innerHTML = '';
    }
});

// Handle upload button click
document.getElementById('uploadButton').addEventListener('click', () => {
    if (fileInput.files.length > 0) {
        handleFileUpload(fileInput.files[0]);
    } else {
        alert('Please select a file to upload.');
    }
});

// Add preview container after file input
fileInput.parentNode.insertBefore(previewContainer, fileInput.nextSibling);