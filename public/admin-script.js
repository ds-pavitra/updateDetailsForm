document.addEventListener('DOMContentLoaded', function () {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const professionFilter = document.getElementById('professionFilter');
    const exportExcelBtn = document.getElementById('exportExcel');
    const downloadPhotosBtn = document.getElementById('downloadPhotos');
    const photoModal = document.getElementById('photoModal');
    const enlargedPhoto = document.getElementById('enlargedPhoto');
    const modalCaption = document.getElementById('modalCaption');
    const detailsModal = document.getElementById('detailsModal');
    const detailsContent = document.getElementById('detailsContent');
    const closeButtons = document.querySelectorAll('.close-modal');

    let allRegistrations = [];

    function fetchRegistrations() {
        fetch('/api/registrations')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                allRegistrations = data;
                renderRegistrations(data);
                searchInput.disabled = false;
                professionFilter.disabled = false;
            })
            .catch(error => {
                console.error('Error fetching registrations:', error);
                tableBody.innerHTML = `
                    <tr class="error-row">
                        <td colspan="100%">Error loading data. Please try refreshing the page.</td>
                    </tr>
                `;
            });
    }

    function renderRegistrations(registrations) {
        if (registrations.length === 0) {
            tableBody.innerHTML = `
                <tr class="empty-data">
                    <td colspan="100%">No registration data found</td>
                </tr>
            `;
            return;
        }

        // Create dynamic table headers
        const headers = Object.keys(registrations[0]);
        tableHead.innerHTML = '';
        const headerRow = document.createElement('tr');

        headers.forEach(key => {
            const th = document.createElement('th');
            th.textContent = capitalizeFirstLetter(key.replace(/([A-Z])/g, ' $1'));
            headerRow.appendChild(th);
        });

        tableHead.appendChild(headerRow);
        tableBody.innerHTML = '';

        registrations.forEach(reg => {
            const row = document.createElement('tr');

            headers.forEach(key => {
                const td = document.createElement('td');
                let value = reg[key];

                if (key === 'photo') {
                    const filePath = value ? value.replace(/^.*\\uploads\\/, 'uploads/') : 'profilePhoto.png';
                    const photoLink = document.createElement('a');
                    photoLink.href = `/${filePath}`;
                    photoLink.target = '_blank';
                    photoLink.rel = 'noopener noreferrer';

                    const img = document.createElement('img');
                    img.src = `/${filePath}`;
                    img.alt = `${reg.first_name} ${reg.last_name}`;
                    img.className = 'photo-thumbnail';

                    photoLink.appendChild(img);
                    td.appendChild(photoLink);
                } else if (key === 'dob' || key === 'createdAt') {
                    td.textContent = value ? new Date(value).toLocaleDateString() : '-';
                } else {
                    td.textContent = value && value !== '' ? value : '-';
                }

                row.appendChild(td);
            });

            tableBody.appendChild(row);
        });
    }

    function filterRegistrations() {
        const searchTerm = searchInput.value.toLowerCase();
        const professionValue = professionFilter.value;

        const filteredData = allRegistrations.filter(reg => {
            const matchSearch =
                `${reg.first_name} ${reg.middle_name || ''} ${reg.last_name}`.toLowerCase().includes(searchTerm) ||
                reg.email.toLowerCase().includes(searchTerm) ||
                reg.whoareyou.toLowerCase().includes(searchTerm);

            const matchProfession = professionValue === '' || reg.whoareyou === professionValue;

            return matchSearch && matchProfession;
        });

        renderRegistrations(filteredData);
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    searchInput.addEventListener('input', filterRegistrations);
    professionFilter.addEventListener('change', filterRegistrations);

    exportExcelBtn.addEventListener('click', () => {
        window.location.href = '/api/export-excel';
    });

    downloadPhotosBtn.addEventListener('click', () => {
        window.location.href = '/api/download-photos';
    });

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            photoModal.style.display = 'none';
            detailsModal.style.display = 'none';
        });
    });

    window.addEventListener('click', event => {
        if (event.target === photoModal) photoModal.style.display = 'none';
        if (event.target === detailsModal) detailsModal.style.display = 'none';
    });

    fetchRegistrations();
});
