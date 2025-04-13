document.addEventListener('DOMContentLoaded', function() {
    // References to form elements
    const form = document.getElementById('registrationForm');
    const professionRadios = document.querySelectorAll('input[name="whoareyou"]');
    const studentFields = document.getElementById('studentFields');
    const employeeFields = document.getElementById('employeeFields');
    const businessFields = document.getElementById('businessFields');
    const photoInput = document.getElementById('photo');
    const photoPreview = document.getElementById('photoPreview');
    
    // Handle profession selection to show/hide relevant fields
    professionRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            // Hide all conditional fields first
            studentFields.style.display = 'none';
            employeeFields.style.display = 'none';
            businessFields.style.display = 'none';
            
            // Show the selected profession's fields
            if (this.value === 'student') {
                studentFields.style.display = 'block';
                resetFieldsRequirement(employeeFields, false);
                resetFieldsRequirement(businessFields, false);
                resetFieldsRequirement(studentFields, true);
            } else if (this.value === 'employee') {
                employeeFields.style.display = 'block';
                resetFieldsRequirement(studentFields, false);
                resetFieldsRequirement(businessFields, false);
                resetFieldsRequirement(employeeFields, true);
            } else if (this.value === 'business') {
                businessFields.style.display = 'block';
                resetFieldsRequirement(studentFields, false);
                resetFieldsRequirement(employeeFields, false);
                resetFieldsRequirement(businessFields, true);
            }
        });
    });
    
    // Handle photo preview
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                photoPreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            photoPreview.src = 'placeholder-profile.png';
        }
    });
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            // Create FormData object to handle file uploads
            const formData = new FormData(form);
            
            // Send data to the server
            fetch('/api/register', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                alert('Registration successful!');
                form.reset();
                photoPreview.src = 'placeholder-profile.png';
            })
            .catch(error => {
                console.error('Error:', error);
                alert('There was a problem with your registration. Please try again.');
            });
        }
    });
    
    // Form validation
    function validateForm() {
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            if (field.value.trim() === '') {
                highlightError(field, 'This field is required');
                isValid = false;
            } else {
                removeError(field);
            }
        });
        
        // Validate email format
        const emailField = document.getElementById('email');
        if (emailField.value && !isValidEmail(emailField.value)) {
            highlightError(emailField, 'Please enter a valid email address');
            isValid = false;
        }
        
        // Validate mobile number (basic validation)
        const mobileField = document.getElementById('mobile');
        if (mobileField.value && !isValidMobile(mobileField.value)) {
            highlightError(mobileField, 'Please enter a valid mobile number');
            isValid = false;
        }
        
        return isValid;
    }
    
    // Helper functions for validation
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    function isValidMobile(mobile) {
        const regex = /^\d{10,15}$/;
        return regex.test(mobile.replace(/[- +]/g, ''));
    }
    
    function highlightError(field, message) {
        field.classList.add('error');
        
        // Check if error message already exists
        let errorEl = field.nextElementSibling;
        if (errorEl && errorEl.classList.contains('error-message')) {
            errorEl.textContent = message;
        } else {
            // Create and append error message element
            errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.textContent = message;
            field.parentNode.insertBefore(errorEl, field.nextSibling);
        }
    }
    
    function removeError(field) {
        field.classList.remove('error');
        
        // Remove error message if exists
        const errorEl = field.nextElementSibling;
        if (errorEl && errorEl.classList.contains('error-message')) {
            errorEl.remove();
        }
    }
    
    // Toggle required attribute for relevant fields
    function resetFieldsRequirement(container, required) {
        const inputs = container.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (required) {
                input.setAttribute('required', '');
            } else {
                input.removeAttribute('required');
            }
        });
    }
    
    // Initialize the form with student fields shown by default
    resetFieldsRequirement(employeeFields, false);
    resetFieldsRequirement(businessFields, false);
});
