const CandyDropdown = {
    init() {
        this.bindEvents();
        this.initializeDropdowns();
    },

    initializeDropdowns() {
        const containers = document.querySelectorAll('.candy-dropdown-container');
        containers.forEach(container => {
            const select = container.querySelector('select');
            if (select) {
                this.createCustomDropdown(container, select);
            }
        });
    },

    bindEvents() {
        document.addEventListener('click', (e) => {
            const container = e.target.closest('.candy-dropdown-container');
            const allContainers = document.querySelectorAll('.candy-dropdown-container');
            
            allContainers.forEach(c => {
                if (c !== container) {
                    c.classList.remove('open');
                }
            });
            
            if (container) {
                container.classList.toggle('open');
            }
        });

        document.addEventListener('click', (e) => {
            const option = e.target.closest('.candy-dropdown-option');
            if (option && !option.classList.contains('disabled')) {
                this.selectOption(option);
            }
        });

        document.addEventListener('keydown', (e) => {
            const openContainer = document.querySelector('.candy-dropdown-container.open');
            if (!openContainer) return;
            
            const menu = openContainer.querySelector('.candy-dropdown-menu');
            const options = menu.querySelectorAll('.candy-dropdown-option:not(.disabled)');
            const selectedIndex = Array.from(options).findIndex(opt => opt.classList.contains('selected'));
            
            let newIndex = selectedIndex;
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    newIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    newIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (options[newIndex]) {
                        this.selectOption(options[newIndex]);
                    }
                    break;
                case 'Escape':
                    openContainer.classList.remove('open');
                    break;
            }
            
            if (options[newIndex]) {
                options.forEach(opt => opt.classList.remove('selected'));
                options[newIndex].classList.add('selected');
                options[newIndex].scrollIntoView({ block: 'nearest' });
            }
        });
    },

    createCustomDropdown(container, select) {
        select.style.display = 'none';
        
        const customSelect = document.createElement('div');
        customSelect.className = 'candy-dropdown';
        customSelect.setAttribute('tabindex', '0');
        
        const arrow = document.createElement('span');
        arrow.className = 'candy-dropdown-arrow';
        customSelect.appendChild(arrow);
        
        const displayText = document.createElement('span');
        displayText.className = 'candy-dropdown-display';
        customSelect.appendChild(displayText);
        
        const menu = document.createElement('ul');
        menu.className = 'candy-dropdown-menu';
        
        const options = select.querySelectorAll('option');
        options.forEach(option => {
            const li = document.createElement('li');
            li.className = 'candy-dropdown-option';
            li.textContent = option.textContent;
            li.setAttribute('data-value', option.value);
            
            if (option.selected) {
                li.classList.add('selected');
                displayText.textContent = option.textContent;
            }
            
            if (option.disabled) {
                li.classList.add('disabled');
            }
            
            menu.appendChild(li);
        });
        
        container.appendChild(customSelect);
        container.appendChild(menu);
    },

    selectOption(option) {
        const menu = option.parentElement;
        const container = menu.parentElement;
        const select = container.querySelector('select');
        const displayText = container.querySelector('.candy-dropdown-display');
        const options = menu.querySelectorAll('.candy-dropdown-option');
        
        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        const value = option.getAttribute('data-value');
        displayText.textContent = option.textContent;
        
        select.value = value;
        
        container.classList.remove('open');
        
        select.dispatchEvent(new CustomEvent('change', {
            detail: { value: value, text: option.textContent },
            bubbles: true
        }));
    },

    setValue(selector, value) {
        const container = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!container) return;
        
        const select = container.querySelector('select');
        const options = container.querySelectorAll('.candy-dropdown-option');
        const displayText = container.querySelector('.candy-dropdown-display');
        
        select.value = value;
        
        options.forEach(opt => {
            if (opt.getAttribute('data-value') === value) {
                opt.classList.add('selected');
                displayText.textContent = opt.textContent;
            } else {
                opt.classList.remove('selected');
            }
        });
    },

    getValue(selector) {
        const container = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!container) return null;
        
        const select = container.querySelector('select');
        return select.value;
    },

    getText(selector) {
        const container = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!container) return null;
        
        const displayText = container.querySelector('.candy-dropdown-display');
        return displayText.textContent;
    },

    create(options = {}) {
        const container = document.createElement('div');
        container.className = 'candy-dropdown-container';
        
        if (options.size) {
            container.classList.add('candy-dropdown-' + options.size);
        }
        
        if (options.variant) {
            container.classList.add('candy-dropdown-' + options.variant);
        }
        
        const select = document.createElement('select');
        
        if (options.options) {
            options.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value || opt;
                option.textContent = opt.label || opt;
                
                if (opt.selected) {
                    option.selected = true;
                }
                
                if (opt.disabled) {
                    option.disabled = true;
                }
                
                select.appendChild(option);
            });
        }
        
        container.appendChild(select);
        
        this.createCustomDropdown(container, select);
        
        if (options.parent) {
            document.querySelector(options.parent).appendChild(container);
        }
        
        if (options.onChange) {
            select.addEventListener('change', (e) => {
                options.onChange(e.target.value, e);
            });
        }
        
        return container;
    },

    enable(selector) {
        const container = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!container) return;
        
        const select = container.querySelector('select');
        const customSelect = container.querySelector('.candy-dropdown');
        const options = container.querySelectorAll('.candy-dropdown-option');
        
        select.disabled = false;
        customSelect.removeAttribute('disabled');
        customSelect.style.opacity = '1';
        customSelect.style.cursor = 'pointer';
        
        options.forEach(opt => opt.classList.remove('disabled'));
    },

    disable(selector) {
        const container = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!container) return;
        
        const select = container.querySelector('select');
        const customSelect = container.querySelector('.candy-dropdown');
        
        select.disabled = true;
        customSelect.setAttribute('disabled', '');
        customSelect.style.opacity = '0.6';
        customSelect.style.cursor = 'not-allowed';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CandyDropdown.init();
});