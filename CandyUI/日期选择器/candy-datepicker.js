/* ============================================
   CandyUI - 日期选择器组件JavaScript
   完整功能实现：日期选择、月份选择、年份选择、范围选择
   ============================================ */

class CandyDatepicker {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            format: 'YYYY-MM-DD',
            language: 'zh-CN',
            autoclose: true,
            todayHighlight: true,
            startDate: null,
            endDate: null,
            startView: 'days', // days, months, years
            minViewMode: 'days', // days, months, years
            ...options
        };
        
        this.date = new Date();
        this.viewDate = new Date();
        this.viewMode = 'days';
        this.selectedDate = null;
        this.rangeStart = null;
        this.rangeEnd = null;
        this.isSelectingStart = true;
        
        this.init();
    }

    init() {
        this.createInput();
        this.createDropdown();
        this.updateView();
        this.bindEvents();
        
        if (this.options.todayHighlight) {
            this.highlightToday();
        }
    }

    createInput() {
        if (this.element.querySelector('.datepicker-input')) return;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'datepicker-input';
        input.readOnly = true;
        input.placeholder = this.getPlaceholder();
        
        this.element.appendChild(input);
        this.input = input;
    }

    createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'datepicker-dropdown';
        dropdown.innerHTML = this.getDropdownContent();
        
        this.element.appendChild(dropdown);
        this.dropdown = dropdown;
        this.calendar = dropdown.querySelector('.datepicker-calendar');
    }

    getDropdownContent() {
        return `
            <div class="datepicker-calendar">
                <div class="datepicker-header">
                    <button type="button" class="datepicker-nav-btn datepicker-prev">❮</button>
                    <span class="datepicker-title"></span>
                    <button type="button" class="datepicker-nav-btn datepicker-next">❯</button>
                </div>
                <div class="datepicker-content"></div>
            </div>
        `;
    }

    getPlaceholder() {
        return '选择日期';
    }

    bindEvents() {
        // 点击输入框切换
        this.input.addEventListener('click', () => {
            this.toggle();
        });
        
        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target)) {
                this.close();
            }
        });
        
        // 导航按钮
        this.dropdown.querySelector('.datepicker-prev').addEventListener('click', () => {
            this.prev();
        });
        
        this.dropdown.querySelector('.datepicker-next').addEventListener('click', () => {
            this.next();
        });
        
        // 标题点击切换视图
        this.dropdown.querySelector('.datepicker-title').addEventListener('click', () => {
            this.cycleViewMode();
        });
        
        // 内容区域点击（委托）
        this.dropdown.querySelector('.datepicker-content').addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('datepicker-day')) {
                this.selectDay(target);
            } else if (target.classList.contains('datepicker-month')) {
                this.selectMonth(target);
            } else if (target.classList.contains('datepicker-year')) {
                this.selectYear(target);
            }
        });
        
        // 键盘导航
        this.input.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }

    toggle() {
        if (this.element.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.element.classList.add('open');
        this.input.focus();
        this.updateView();
    }

    close() {
        this.element.classList.remove('open');
    }

    updateView() {
        const title = this.dropdown.querySelector('.datepicker-title');
        const content = this.dropdown.querySelector('.datepicker-content');
        
        switch (this.viewMode) {
            case 'days':
                title.textContent = this.formatDate(this.viewDate, 'YYYY年MM月');
                content.innerHTML = this.renderDays();
                break;
            case 'months':
                title.textContent = this.viewDate.getFullYear() + '年';
                content.innerHTML = this.renderMonths();
                break;
            case 'years':
                title.textContent = this.getYearRange();
                content.innerHTML = this.renderYears();
                break;
        }
    }

    renderDays() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        const isSelectedMonth = this.selectedDate && 
            this.selectedDate.getFullYear() === year && 
            this.selectedDate.getMonth() === month;
        
        let html = `
            <div class="datepicker-weekdays">
                <div class="datepicker-weekday">日</div>
                <div class="datepicker-weekday">一</div>
                <div class="datepicker-weekday">二</div>
                <div class="datepicker-weekday">三</div>
                <div class="datepicker-weekday">四</div>
                <div class="datepicker-weekday">五</div>
                <div class="datepicker-weekday">六</div>
            </div>
            <div class="datepicker-days">
        `;
        
        // 上个月的天数
        const prevMonth = new Date(year, month, 0);
        const prevDays = prevMonth.getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevDays - i;
            const date = new Date(year, month - 1, day);
            const isDisabled = this.isDateDisabled(date);
            html += `<button type="button" class="datepicker-day other-month ${isDisabled ? 'disabled' : ''}" 
                          data-date="${date.toISOString()}">${day}</button>`;
        }
        
        // 当前月的天数
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isDisabled = this.isDateDisabled(date);
            const isToday = isCurrentMonth && today.getDate() === day;
            const isSelected = isSelectedMonth && this.selectedDate.getDate() === day;
            
            let classes = 'datepicker-day';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (isDisabled) classes += ' disabled';
            
            html += `<button type="button" class="${classes}" 
                          data-date="${date.toISOString()}">${day}</button>`;
        }
        
        // 下个月的天数
        const remainingDays = 42 - (startDay + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            const isDisabled = this.isDateDisabled(date);
            html += `<button type="button" class="datepicker-day other-month ${isDisabled ? 'disabled' : ''}" 
                          data-date="${date.toISOString()}">${day}</button>`;
        }
        
        html += '</div>';
        return html;
    }

    renderMonths() {
        const months = ['一月', '二月', '三月', '四月', '五月', '六月', 
                        '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const currentYear = this.viewDate.getFullYear();
        const selectedYear = this.selectedDate ? this.selectedDate.getFullYear() : null;
        
        let html = '<div class="datepicker-months">';
        
        months.forEach((month, index) => {
            const isActive = selectedYear === currentYear && 
                this.selectedDate && this.selectedDate.getMonth() === index;
            html += `<button type="button" class="datepicker-month ${isActive ? 'active' : ''}" 
                          data-month="${index}">${month}</button>`;
        });
        
        html += '</div>';
        return html;
    }

    renderYears() {
        const range = this.getYearRange();
        const [start, end] = range.split('-').map(y => parseInt(y.trim()));
        const selectedYear = this.selectedDate ? this.selectedDate.getFullYear() : null;
        
        let html = '<div class="datepicker-years">';
        
        for (let year = start; year <= end; year++) {
            const isActive = selectedYear === year;
            html += `<button type="button" class="datepicker-year ${isActive ? 'active' : ''}" 
                          data-year="${year}">${year}</button>`;
        }
        
        html += '</div>';
        return html;
    }

    getYearRange() {
        const currentYear = this.viewDate.getFullYear();
        const start = Math.floor(currentYear / 10) * 10;
        const end = start + 9;
        return `${start} - ${end}`;
    }

    selectDay(target) {
        if (target.classList.contains('disabled') || target.classList.contains('other-month')) {
            return;
        }
        
        const dateStr = target.dataset.date;
        this.selectedDate = new Date(dateStr);
        this.updateView();
        this.setInputValue();
        this.dispatchEvent('candy-datepicker-change', { date: this.selectedDate });
        
        if (this.options.autoclose) {
            setTimeout(() => this.close(), 200);
        }
    }

    selectMonth(target) {
        const month = parseInt(target.dataset.month);
        this.viewDate.setMonth(month);
        this.viewMode = 'days';
        this.updateView();
    }

    selectYear(target) {
        const year = parseInt(target.dataset.year);
        this.viewDate.setFullYear(year);
        this.viewMode = 'months';
        this.updateView();
    }

    prev() {
        switch (this.viewMode) {
            case 'days':
                this.viewDate.setMonth(this.viewDate.getMonth() - 1);
                break;
            case 'months':
                this.viewDate.setFullYear(this.viewDate.getFullYear() - 1);
                break;
            case 'years':
                this.viewDate.setFullYear(this.viewDate.getFullYear() - 10);
                break;
        }
        this.updateView();
    }

    next() {
        switch (this.viewMode) {
            case 'days':
                this.viewDate.setMonth(this.viewDate.getMonth() + 1);
                break;
            case 'months':
                this.viewDate.setFullYear(this.viewDate.getFullYear() + 1);
                break;
            case 'years':
                this.viewDate.setFullYear(this.viewDate.getFullYear() + 10);
                break;
        }
        this.updateView();
    }

    cycleViewMode() {
        const modes = ['days', 'months', 'years'];
        const currentIndex = modes.indexOf(this.viewMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        
        if (nextIndex === 0 && this.options.minViewMode === 'days') return;
        if (nextIndex === 1 && this.options.minViewMode === 'months') {
            this.viewMode = 'days';
        } else {
            this.viewMode = modes[nextIndex];
        }
        
        this.updateView();
    }

    handleKeydown(e) {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        const day = this.viewDate.getDate();
        
        switch (e.key) {
            case 'ArrowLeft':
                this.viewDate.setDate(day - 1);
                this.updateView();
                break;
            case 'ArrowRight':
                this.viewDate.setDate(day + 1);
                this.updateView();
                break;
            case 'ArrowUp':
                this.viewDate.setDate(day - 7);
                this.updateView();
                break;
            case 'ArrowDown':
                this.viewDate.setDate(day + 7);
                this.updateView();
                break;
            case 'Enter':
                if (this.viewMode === 'days') {
                    this.selectedDate = new Date(this.viewDate);
                    this.setInputValue();
                    this.close();
                }
                break;
            case 'Escape':
                this.close();
                break;
        }
    }

    isDateDisabled(date) {
        if (this.options.startDate && date < this.options.startDate) return true;
        if (this.options.endDate && date > this.options.endDate) return true;
        return false;
    }

    highlightToday() {
        // 今天会在renderDays中自动高亮
    }

    setInputValue() {
        if (this.selectedDate) {
            this.input.value = this.formatDate(this.selectedDate, this.options.format);
        }
    }

    formatDate(date, format) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    }

    getDate() {
        return this.selectedDate;
    }

    setDate(date) {
        if (date instanceof Date) {
            this.selectedDate = date;
            this.viewDate = new Date(date);
            this.updateView();
            this.setInputValue();
        }
    }

    clear() {
        this.selectedDate = null;
        this.input.value = '';
        this.updateView();
        this.dispatchEvent('candy-datepicker-change', { date: null });
    }

    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true
        });
        this.element.dispatchEvent(event);
    }
}

// ============================================
// 日期范围选择器类
// ============================================

class CandyDatepickerRange {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            format: 'YYYY-MM-DD',
            ...options
        };
        
        this.startDate = null;
        this.endDate = null;
        this.activeInput = 'start';
        
        this.init();
    }

    init() {
        this.createInputs();
        this.createDropdown();
        this.bindEvents();
    }

    createInputs() {
        if (this.element.querySelector('.datepicker-range-inputs')) return;
        
        const container = document.createElement('div');
        container.className = 'datepicker-range-inputs';
        container.innerHTML = `
            <input type="text" class="datepicker-input datepicker-start" placeholder="开始日期" readonly>
            <span class="datepicker-range-separator">至</span>
            <input type="text" class="datepicker-input datepicker-end" placeholder="结束日期" readonly>
        `;
        
        this.element.appendChild(container);
        this.startInput = container.querySelector('.datepicker-start');
        this.endInput = container.querySelector('.datepicker-end');
    }

    createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'datepicker-dropdown datepicker-range-dropdown';
        dropdown.innerHTML = `
            <div class="datepicker-calendar">
                <div class="datepicker-header">
                    <button type="button" class="datepicker-nav-btn datepicker-prev">❮</button>
                    <span class="datepicker-title"></span>
                    <button type="button" class="datepicker-nav-btn datepicker-next">❯</button>
                </div>
                <div class="datepicker-content"></div>
            </div>
        `;
        
        this.element.appendChild(dropdown);
        this.dropdown = dropdown;
        this.calendar = dropdown.querySelector('.datepicker-calendar');
        
        this.viewDate = new Date();
        this.viewMode = 'days';
        this.updateView();
    }

    bindEvents() {
        this.startInput.addEventListener('click', () => {
            this.activeInput = 'start';
            this.open();
        });
        
        this.endInput.addEventListener('click', () => {
            this.activeInput = 'end';
            this.open();
        });
        
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target)) {
                this.close();
            }
        });
        
        this.dropdown.querySelector('.datepicker-prev').addEventListener('click', () => this.prev());
        this.dropdown.querySelector('.datepicker-next').addEventListener('click', () => this.next());
        this.dropdown.querySelector('.datepicker-title').addEventListener('click', () => this.cycleViewMode());
        
        this.dropdown.querySelector('.datepicker-content').addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('datepicker-day')) {
                this.selectDay(target);
            } else if (target.classList.contains('datepicker-month')) {
                this.selectMonth(target);
            } else if (target.classList.contains('datepicker-year')) {
                this.selectYear(target);
            }
        });
    }

    toggle() {
        if (this.dropdown.style.display === 'none' || !this.dropdown.style.display) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        this.dropdown.style.display = 'block';
        this.updateView();
    }

    close() {
        this.dropdown.style.display = 'none';
    }

    updateView() {
        const title = this.dropdown.querySelector('.datepicker-title');
        const content = this.dropdown.querySelector('.datepicker-content');
        
        switch (this.viewMode) {
            case 'days':
                title.textContent = this.formatDate(this.viewDate, 'YYYY年MM月');
                content.innerHTML = this.renderDays();
                break;
            case 'months':
                title.textContent = this.viewDate.getFullYear() + '年';
                content.innerHTML = this.renderMonths();
                break;
            case 'years':
                title.textContent = this.getYearRange();
                content.innerHTML = this.renderYears();
                break;
        }
    }

    renderDays() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        
        let html = `
            <div class="datepicker-weekdays">
                <div class="datepicker-weekday">日</div>
                <div class="datepicker-weekday">一</div>
                <div class="datepicker-weekday">二</div>
                <div class="datepicker-weekday">三</div>
                <div class="datepicker-weekday">四</div>
                <div class="datepicker-weekday">五</div>
                <div class="datepicker-weekday">六</div>
            </div>
            <div class="datepicker-days">
        `;
        
        // 上个月
        const prevMonth = new Date(year, month, 0);
        const prevDays = prevMonth.getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevDays - i;
            html += `<button type="button" class="datepicker-day other-month" 
                          data-date="${new Date(year, month - 1, day).toISOString()}">${day}</button>`;
        }
        
        // 当前月
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = isCurrentMonth && today.getDate() === day;
            const isInRange = this.isInRange(date);
            const isRangeStart = this.startDate && this.isSameDay(date, this.startDate);
            const isRangeEnd = this.endDate && this.isSameDay(date, this.endDate);
            
            let classes = 'datepicker-day';
            if (isToday) classes += ' today';
            if (isInRange) classes += ' in-range';
            if (isRangeStart) classes += ' range-start';
            if (isRangeEnd) classes += ' range-end';
            
            html += `<button type="button" class="${classes}" 
                          data-date="${date.toISOString()}">${day}</button>`;
        }
        
        // 下个月
        const remainingDays = 42 - (startDay + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            html += `<button type="button" class="datepicker-day other-month" 
                          data-date="${new Date(year, month + 1, day).toISOString()}">${day}</button>`;
        }
        
        html += '</div>';
        return html;
    }

    renderMonths() {
        const months = ['一月', '二月', '三月', '四月', '五月', '六月', 
                        '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const currentYear = this.viewDate.getFullYear();
        
        let html = '<div class="datepicker-months">';
        
        months.forEach((month, index) => {
            html += `<button type="button" class="datepicker-month" 
                          data-month="${index}">${month}</button>`;
        });
        
        html += '</div>';
        return html;
    }

    renderYears() {
        const range = this.getYearRange();
        const [start, end] = range.split('-').map(y => parseInt(y.trim()));
        
        let html = '<div class="datepicker-years">';
        
        for (let year = start; year <= end; year++) {
            html += `<button type="button" class="datepicker-year" 
                          data-year="${year}">${year}</button>`;
        }
        
        html += '</div>';
        return html;
    }

    getYearRange() {
        const currentYear = this.viewDate.getFullYear();
        const start = Math.floor(currentYear / 10) * 10;
        const end = start + 9;
        return `${start} - ${end}`;
    }

    selectDay(target) {
        const date = new Date(target.dataset.date);
        
        if (this.activeInput === 'start') {
            this.startDate = date;
            this.endDate = null;
            this.activeInput = 'end';
        } else {
            if (date < this.startDate) {
                this.endDate = this.startDate;
                this.startDate = date;
            } else {
                this.endDate = date;
            }
            this.activeInput = 'start';
        }
        
        this.startInput.value = this.startDate ? this.formatDate(this.startDate, this.options.format) : '';
        this.endInput.value = this.endDate ? this.formatDate(this.endDate, this.options.format) : '';
        
        this.updateView();
        this.dispatchEvent('candy-datepicker-range-change', { 
            startDate: this.startDate, 
            endDate: this.endDate 
        });
    }

    selectMonth(target) {
        const month = parseInt(target.dataset.month);
        this.viewDate.setMonth(month);
        this.viewMode = 'days';
        this.updateView();
    }

    selectYear(target) {
        const year = parseInt(target.dataset.year);
        this.viewDate.setFullYear(year);
        this.viewMode = 'months';
        this.updateView();
    }

    prev() {
        switch (this.viewMode) {
            case 'days':
                this.viewDate.setMonth(this.viewDate.getMonth() - 1);
                break;
            case 'months':
                this.viewDate.setFullYear(this.viewDate.getFullYear() - 1);
                break;
            case 'years':
                this.viewDate.setFullYear(this.viewDate.getFullYear() - 10);
                break;
        }
        this.updateView();
    }

    next() {
        switch (this.viewMode) {
            case 'days':
                this.viewDate.setMonth(this.viewDate.getMonth() + 1);
                break;
            case 'months':
                this.viewDate.setFullYear(this.viewDate.getFullYear() + 1);
                break;
            case 'years':
                this.viewDate.setFullYear(this.viewDate.getFullYear() + 10);
                break;
        }
        this.updateView();
    }

    cycleViewMode() {
        const modes = ['days', 'months', 'years'];
        const currentIndex = modes.indexOf(this.viewMode);
        this.viewMode = modes[(currentIndex + 1) % modes.length];
        this.updateView();
    }

    isInRange(date) {
        if (!this.startDate || !this.endDate) return false;
        return date >= this.startDate && date <= this.endDate;
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    formatDate(date, format) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    }

    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true
        });
        this.element.dispatchEvent(event);
    }
}

// ============================================
// 时间选择器类
// ============================================

class CandyTimepicker {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        this.options = {
            format: 'HH:mm',
            minuteStep: 1,
            showSeconds: false,
            ...options
        };
        
        this.hour = 0;
        this.minute = 0;
        this.second = 0;
        
        this.init();
    }

    init() {
        this.createInput();
        this.createDropdown();
        this.bindEvents();
    }

    createInput() {
        if (this.element.querySelector('.datepicker-input')) return;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'datepicker-input';
        input.readOnly = true;
        input.placeholder = '选择时间';
        
        this.element.appendChild(input);
        this.input = input;
        this.updateInputValue();
    }

    createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'datepicker-dropdown';
        dropdown.innerHTML = `
            <div class="datepicker-time">
                <div class="datepicker-time-display">
                    <span class="datepicker-time-hour">00</span>
                    <span class="datepicker-time-separator">:</span>
                    <span class="datepicker-time-minute">00</span>
                </div>
                <div class="datepicker-time-controls">
                    <button type="button" class="datepicker-time-btn datepicker-time-up">▲</button>
                    <button type="button" class="datepicker-time-btn datepicker-time-down">▼</button>
                </div>
            </div>
        `;
        
        this.element.appendChild(dropdown);
        this.dropdown = dropdown;
    }

    bindEvents() {
        this.input.addEventListener('click', () => this.toggle());
        
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target)) {
                this.close();
            }
        });
        
        this.dropdown.querySelectorAll('.datepicker-time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const isUp = btn.classList.contains('datepicker-time-up');
                const isHour = btn.closest('.datepicker-time-hour') !== null;
                
                if (isHour) {
                    this.hour = (this.hour + (isUp ? 1 : -1) + 24) % 24;
                } else {
                    this.minute = (this.minute + (isUp ? 5 : -5) + 60) % 60;
                }
                
                this.updateDisplay();
                this.updateInputValue();
            });
        });
    }

    toggle() {
        if (this.dropdown.style.display === 'none') {
            this.dropdown.style.display = 'block';
        } else {
            this.dropdown.style.display = 'none';
        }
    }

    close() {
        this.dropdown.style.display = 'none';
    }

    updateDisplay() {
        const hourDisplay = this.dropdown.querySelector('.datepicker-time-hour');
        const minuteDisplay = this.dropdown.querySelector('.datepicker-time-minute');
        
        hourDisplay.textContent = String(this.hour).padStart(2, '0');
        minuteDisplay.textContent = String(this.minute).padStart(2, '0');
    }

    updateInputValue() {
        this.input.value = `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
    }

    getTime() {
        return {
            hour: this.hour,
            minute: this.minute
        };
    }

    setTime(hour, minute) {
        this.hour = hour;
        this.minute = minute;
        this.updateDisplay();
        this.updateInputValue();
    }
}

// ============================================
// 自动初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // 初始化所有日期选择器
    document.querySelectorAll('[data-datepicker]').forEach(element => {
        const options = JSON.parse(element.dataset.datepicker || '{}');
        new CandyDatepicker(element, options);
    });
    
    // 初始化所有日期范围选择器
    document.querySelectorAll('[data-datepicker-range]').forEach(element => {
        const options = JSON.parse(element.dataset.datepickerRange || '{}');
        new CandyDatepickerRange(element, options);
    });
    
    // 初始化所有时间选择器
    document.querySelectorAll('[data-timepicker]').forEach(element => {
        new CandyTimepicker(element);
    });
});

// 导出到全局
window.CandyDatepicker = CandyDatepicker;
window.CandyDatepickerRange = CandyDatepickerRange;
window.CandyTimepicker = CandyTimepicker;
