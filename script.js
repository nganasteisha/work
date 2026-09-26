const STORAGE_KEY = "workScheduleData";
const FIREBASE_PATH = "workScheduleData";

/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyCNJW5NW9g0RBxAgFjqPW_qBKZ08FgSZGU",
    authDomain: "grafik-roboty.firebaseapp.com",
    databaseURL: "https://grafik-roboty-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "grafik-roboty",
    storageBucket: "grafik-roboty.firebasestorage.app",
    messagingSenderId: "875282708412",
    appId: "1:875282708412:web:3f17d503f4b9118c2ddb9",
    measurementId: "G-11FLWD0XZL"
};

let db = null;
let databaseRef = null;
let firebaseReady = false;

if (typeof firebase !== "undefined") {
    try {
        firebase.initializeApp(firebaseConfig);

        db = firebase.database();
        databaseRef = db.ref(FIREBASE_PATH);

        console.log("Firebase підключено");
    } catch (error) {
        console.error("Помилка Firebase:", error);
    }
} else {
    console.error("Firebase SDK не завантажився");
}


/* =========================================================
   МАГАЗИНИ
========================================================= */

const defaultStores = [
    "Сихівська",
    "Санта",
    "Іскра",
    "Довженка",
    "К35",
    "К11"
];


/* =========================================================
   ЛОКАЛЬНІ ДАНІ
========================================================= */

function loadData() {

    try {

        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (saved) {

            const parsed =
                JSON.parse(saved);

            return {
                stores: Array.isArray(parsed.stores)
                    ? parsed.stores
                    : [...defaultStores],

                /*
                 * Працівники НЕ прописані тут.
                 *
                 * Якщо їх уже додавали через сайт —
                 * вони беруться з localStorage.
                 *
                 * Якщо даних немає —
                 * список буде порожній.
                 */

                employees:
                    Array.isArray(parsed.employees)
                        ? parsed.employees
                        : [],

                shifts:
                    parsed.shifts &&
                    typeof parsed.shifts === "object"
                        ? parsed.shifts
                        : {}
            };
        }

    } catch (error) {

        console.error(
            "Помилка завантаження даних:",
            error
        );
    }


    return {
        stores: [...defaultStores],
        employees: [],
        shifts: {}
    };
}


let data = loadData();


/* =========================================================
   НОРМАЛІЗАЦІЯ ДАНИХ
========================================================= */

function normalizeData(source) {

    if (!source || typeof source !== "object") {

        return {
            stores: [...defaultStores],
            employees: [],
            shifts: {}
        };
    }


    return {

        stores:
            Array.isArray(source.stores)
                ? source.stores
                : [...defaultStores],

        employees:
            Array.isArray(source.employees)
                ? source.employees
                : [],

        shifts:
            source.shifts &&
            typeof source.shifts === "object"
                ? source.shifts
                : {}

    };
}


/* =========================================================
   ЗБЕРЕЖЕННЯ ДАНИХ
========================================================= */

function saveData() {

    data = normalizeData(data);


    /*
     * Зберігаємо локальну копію.
     */

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );


    /*
     * Якщо Firebase уже підключений —
     * зберігаємо туди.
     */

    if (firebaseReady) {

        databaseRef
            .set(data)
            .then(() => {

                console.log(
                    "Дані збережено у Firebase"
                );

            })
            .catch(error => {

                console.error(
                    "Помилка Firebase:",
                    error
                );

            });
    }
}


/* =========================================================
   FIREBASE — ПЕРШЕ ПІДКЛЮЧЕННЯ
========================================================= */

async function initFirebase() {

    if (!databaseRef) {
        console.warn("Firebase недоступний. Працюємо локально.");
        return;
    }

    try {


        const snapshot =
            await databaseRef.once("value");


        /*
         * Якщо Firebase ВЖЕ має дані,
         * використовуємо саме їх.
         */

        if (snapshot.exists()) {

            data =
                normalizeData(
                    snapshot.val()
                );


            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(data)
            );


            console.log(
                "Дані завантажені з Firebase"
            );

        }


        /*
         * Якщо Firebase порожній,
         * переносимо старі дані з цього браузера.
         */

        else {

            data =
                normalizeData(data);


            await databaseRef.set(data);


            console.log(
                "Старі дані перенесені у Firebase"
            );
        }


        firebaseReady = true;


        /*
         * Малюємо актуальні дані.
         */

        renderStores();
        renderEmployees();
        renderCalendar();


        /*
         * Постійна синхронізація.
         *
         * Якщо змінити графік на телефоні —
         * ноутбук отримає ці зміни.
         */

        databaseRef.on(
            "value",
            snapshot => {

                if (!snapshot.exists()) {
                    return;
                }


                const remoteData =
                    normalizeData(
                        snapshot.val()
                    );


                data = remoteData;


                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(data)
                );


                renderStores();
                renderEmployees();
                renderCalendar();


                console.log(
                    "Дані синхронізовано"
                );
            },


            error => {

                console.error(
                    "Помилка синхронізації:",
                    error
                );
            }
        );


    } catch (error) {

        console.error(
            "Firebase недоступний:",
            error
        );

        firebaseReady = false;


        /*
         * Сайт все одно продовжує працювати
         * з локальними даними.
         */

        renderStores();
        renderEmployees();
        renderCalendar();
    }
}


/* =========================================================
   ДАТА
========================================================= */

let currentDate = new Date();

let selectedDate = null;

let editingShiftIndex = null;


/* =========================================================
   ЕЛЕМЕНТИ HTML
========================================================= */

const calendar =
    document.getElementById("calendar");

const monthTitle =
    document.getElementById("monthTitle");

const prevMonth =
    document.getElementById("prevMonth");

const nextMonth =
    document.getElementById("nextMonth");

const todayButton =
    document.getElementById("todayButton");


/* =========================================================
   МОДАЛЬНЕ ВІКНО ЗМІНИ
========================================================= */

const shiftModal =
    document.getElementById("shiftModal");

const modalTitle =
    document.getElementById("modalTitle");

const modalDate =
    document.getElementById("modalDate");

const closeShiftModalButton =
    document.getElementById("closeShiftModal");

const storeSelect =
    document.getElementById("storeSelect");

const employeeSelect =
    document.getElementById("employeeSelect");

const deletedEmployeeWarning =
    document.getElementById("deletedEmployeeWarning");

const saveShiftButton =
    document.getElementById("saveShift");

const deleteShiftButton =
    document.getElementById("deleteShift");


/* =========================================================
   ПРАЦІВНИКИ
========================================================= */

const employeesButton =
    document.getElementById("employeesButton");

const employeesModal =
    document.getElementById("employeesModal");

const closeEmployeesModal =
    document.getElementById("closeEmployeesModal");

const employeeInput =
    document.getElementById("employeeInput");

const addEmployeeButton =
    document.getElementById("addEmployee");

const employeesList =
    document.getElementById("employeesList");

const deleteEmployeeModal =
    document.getElementById("deleteEmployeeModal");

const deleteEmployeeText =
    document.getElementById("deleteEmployeeText");

const confirmDeleteEmployeeButton =
    document.getElementById("confirmDeleteEmployee");

const cancelDeleteEmployeeButton =
    document.getElementById("cancelDeleteEmployee");

const cancelDeleteEmployeeButton2 =
    document.getElementById("cancelDeleteEmployeeButton");

/* =========================================================
   НАЗВИ МІСЯЦІВ
========================================================= */

const monthNames = [
    "Січень",
    "Лютий",
    "Березень",
    "Квітень",
    "Травень",
    "Червень",
    "Липень",
    "Серпень",
    "Вересень",
    "Жовтень",
    "Листопад",
    "Грудень"
];


/* =========================================================
   НАЗВИ ДНІВ
========================================================= */

const dayNames = [
    "Неділя",
    "Понеділок",
    "Вівторок",
    "Середа",
    "Четвер",
    "П'ятниця",
    "Субота"
];


/* =========================================================
   DATE KEY
========================================================= */

function dateKey(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/* =========================================================
   ФОРМАТ ДАТИ
========================================================= */

function formatDate(key) {

    const date =
        new Date(
            key + "T12:00:00"
        );

    return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()].toLowerCase()} ${date.getFullYear()}`;
}


/* =========================================================
   КАЛЕНДАР
========================================================= */

function renderCalendar() {

    if (!calendar) {
        return;
    }


    calendar.innerHTML = "";


    const year =
        currentDate.getFullYear();

    const month =
        currentDate.getMonth();


    if (monthTitle) {

        monthTitle.textContent =
            `${monthNames[month]} ${year}`;
    }


    let firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    /*
     * Понеділок = 0
     */

    firstDay =
        firstDay === 0
            ? 6
            : firstDay - 1;


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const previousMonthDays =
        new Date(
            year,
            month,
            0
        ).getDate();


    const totalCells =
        Math.ceil(
            (
                firstDay +
                daysInMonth
            ) / 7
        ) * 7;


    for (
        let i = 0;
        i < totalCells;
        i++
    ) {

        let dayNumber;

        let cellDate;

        let isOtherMonth = false;


        /* Попередній місяць */

        if (i < firstDay) {

            dayNumber =
                previousMonthDays -
                firstDay +
                i +
                1;


            cellDate =
                new Date(
                    year,
                    month - 1,
                    dayNumber
                );


            isOtherMonth = true;
        }


        /* Поточний місяць */

        else if (
            i <
            firstDay +
            daysInMonth
        ) {

            dayNumber =
                i -
                firstDay +
                1;


            cellDate =
                new Date(
                    year,
                    month,
                    dayNumber
                );
        }


        /* Наступний місяць */

        else {

            dayNumber =
                i -
                (
                    firstDay +
                    daysInMonth
                ) +
                1;


            cellDate =
                new Date(
                    year,
                    month + 1,
                    dayNumber
                );


            isOtherMonth = true;
        }


        const key =
            dateKey(cellDate);


        const dayElement =
            document.createElement("div");


        dayElement.className = "day";


        if (isOtherMonth) {

            dayElement.classList.add(
                "other-month"
            );
        }


        /* Сьогодні */

        const today =
            new Date();


        if (
            cellDate.getDate() ===
                today.getDate() &&

            cellDate.getMonth() ===
                today.getMonth() &&

            cellDate.getFullYear() ===
                today.getFullYear()
        ) {

            dayElement.classList.add(
                "today"
            );
        }


        /* Номер дня */

        const numberElement =
            document.createElement("div");


        numberElement.className =
            "day-number";


        numberElement.textContent =
            dayNumber;


        dayElement.appendChild(
            numberElement
        );


        /* Зміни */

        const shiftsContainer =
            document.createElement("div");


        shiftsContainer.className =
            "shifts";


        const dayShifts =
            Array.isArray(
                data.shifts[key]
            )
                ? data.shifts[key]
                : [];


        dayShifts.forEach(
            (shift, shiftIndex) => {

                const shiftElement =
                    document.createElement("div");


                shiftElement.className =
                    "shift";


                /*
                 * Магазин
                 */

                const storeElement =
                    document.createElement("span");


                storeElement.className =
                    "shift-store";


                storeElement.textContent =
                    shift.store || "";


                /*
                 * Працівник
                 */

                const employeeElement =
                    document.createElement("span");


                employeeElement.className =
                    "shift-employee";


                employeeElement.textContent =
                    shift.employee || "";


                shiftElement.appendChild(
                    storeElement
                );


                shiftElement.appendChild(
                    employeeElement
                );


                /*
                 * Клік по зміні
                 */

                shiftElement.addEventListener(
                    "click",
                    function(event) {

                        event.stopPropagation();


                        openEditShift(
                            key,
                            shiftIndex
                        );
                    }
                );


                shiftsContainer.appendChild(
                    shiftElement
                );
            }
        );


        dayElement.appendChild(
            shiftsContainer
        );


        /*
         * Додати зміну
         */

        const addText =
            document.createElement("div");


        addText.className =
            "add-shift";


        addText.textContent =
            "+ Додати зміну";


        dayElement.appendChild(
            addText
        );


        /*
         * Клік по дню
         */

        dayElement.addEventListener(
            "click",
            function() {

                openAddShift(key);
            }
        );


        calendar.appendChild(
            dayElement
        );
    }
}


/* =========================================================
   МАГАЗИНИ
========================================================= */

function renderStores() {

    if (!storeSelect) {
        return;
    }


    storeSelect.innerHTML = "";


    /*
     * Завжди саме цей порядок.
     */

    const stores = [
        "Сихівська",
        "Санта",
        "Іскра",
        "Довженка",
        "К35",
        "К11"
    ];


    stores.forEach(
        store => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                store;


            option.textContent =
                store;


            storeSelect.appendChild(
                option
            );
        }
    );


    /*
     * Сихівська за замовчуванням.
     */

    storeSelect.value =
        "Сихівська";
}


/* =========================================================
   ПРАЦІВНИКИ
========================================================= */

function renderEmployees() {

    if (!employeeSelect) {
        return;
    }


    employeeSelect.innerHTML = "";


    /*
     * Тут НІКОЛИ не буде
     * списку працівників у коді.
     *
     * Беремо тільки з data.employees.
     */

    data.employees.forEach(
        employee => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                employee;


            option.textContent =
                employee;


            employeeSelect.appendChild(
                option
            );
        }
    );


    renderEmployeesList();
}


/* =========================================================
   СПИСОК ПРАЦІВНИКІВ
========================================================= */

function renderEmployeesList() {

    if (!employeesList) {
        return;
    }


    employeesList.innerHTML = "";


    if (
        data.employees.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.textContent =
            "Працівників поки немає.";


        empty.style.color =
            "#888";


        empty.style.padding =
            "10px";


        employeesList.appendChild(
            empty
        );


        return;
    }


    data.employees.forEach(
        (employee, index) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "employee-item";


            /*
             * Ім'я
             */

            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "employee-name";


            name.textContent =
                employee;


            /*
             * Кнопка видалення
             */

            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.className =
                "delete-employee";


            deleteButton.textContent =
                "🗑";


            deleteButton.addEventListener(
                "click",
                function(event) {

                    event.stopPropagation();


                    deleteEmployee(
                        index
                    );
                }
            );


            item.appendChild(name);

            item.appendChild(
                deleteButton
            );


            employeesList.appendChild(
                item
            );
        }
    );
}


/* =========================================================
   ДОДАТИ ЗМІНУ
========================================================= */

function openAddShift(key) {

    selectedDate = key;

    editingShiftIndex = null;


    if (modalTitle) {

        modalTitle.textContent =
            "Додати зміну";
    }


    if (modalDate) {

        modalDate.textContent =
            formatDate(key);
    }


    renderStores();

    renderEmployees();


    if (deletedEmployeeWarning) {

        deletedEmployeeWarning.style.display =
            "none";
    }


    if (deleteShiftButton) {

        deleteShiftButton.style.display =
            "none";
    }


    if (saveShiftButton) {

        saveShiftButton.textContent =
            "✓ Додати зміну";
    }


    if (shiftModal) {

        shiftModal.classList.add(
            "active"
        );
    }
}


/* =========================================================
   РЕДАГУВАТИ ЗМІНУ
========================================================= */

function openEditShift(
    key,
    shiftIndex
) {

    selectedDate = key;

    editingShiftIndex = shiftIndex;


    const shifts =
        data.shifts[key] || [];


    const shift =
        shifts[shiftIndex];


    if (!shift) {
        return;
    }


    if (modalTitle) {

        modalTitle.textContent =
            "Редагувати зміну";
    }


    if (modalDate) {

        modalDate.textContent =
            formatDate(key);
    }


    renderStores();

    renderEmployees();


    /*
     * Магазин
     */

    if (storeSelect) {

        storeSelect.value =
            shift.store || "";
    }


    /*
     * Перевіряємо, чи працівник
     * ще є у списку.
     */

    const employeeExists =
        data.employees.includes(
            shift.employee
        );


    if (!employeeExists) {

        /*
         * Працівника видалили,
         * але стара зміна залишилась.
         *
         * Додаємо його тимчасово,
         * щоб стару зміну можна було
         * видалити або відредагувати.
         */

        const oldOption =
            document.createElement(
                "option"
            );


        oldOption.value =
            shift.employee;


        oldOption.textContent =
            `${shift.employee} (видалений зі списку)`;


        employeeSelect.appendChild(
            oldOption
        );


        if (deletedEmployeeWarning) {

            deletedEmployeeWarning.style.display =
                "block";
        }

    } else {

        if (deletedEmployeeWarning) {

            deletedEmployeeWarning.style.display =
                "none";
        }
    }


    if (employeeSelect) {

        employeeSelect.value =
            shift.employee || "";
    }


    if (deleteShiftButton) {

        deleteShiftButton.style.display =
            "block";
    }


    if (saveShiftButton) {

        saveShiftButton.textContent =
            "✓ Зберегти зміни";
    }


    if (shiftModal) {

        shiftModal.classList.add(
            "active"
        );
    }
}


/* =========================================================
   ЗБЕРЕГТИ ЗМІНУ
========================================================= */

function saveShift() {

    if (!selectedDate) {
        return;
    }


    const store =
        storeSelect
            ? storeSelect.value
            : "";


    const employee =
        employeeSelect
            ? employeeSelect.value
            : "";


    if (!store || !employee) {

        alert(
            "Вибери магазин і працівника."
        );


        return;
    }


    if (
        !data.shifts[selectedDate]
    ) {

        data.shifts[selectedDate] = [];
    }


    /*
     * Редагування
     */

    if (
        editingShiftIndex !== null &&

        data.shifts[selectedDate]
            [editingShiftIndex]
    ) {

        data.shifts[selectedDate]
            [editingShiftIndex] = {

                store: store,

                employee: employee
            };
    }


    /*
     * Нова зміна
     */

    else {

        data.shifts[selectedDate].push({

            store: store,

            employee: employee
        });
    }


    saveData();

    closeShiftModal();

    renderCalendar();
}


/* =========================================================
   ВИДАЛИТИ ЗМІНУ
========================================================= */

function deleteShift() {

    if (
        !selectedDate ||
        editingShiftIndex === null
    ) {

        return;
    }


    const shifts =
        data.shifts[selectedDate];


    if (!shifts) {
        return;
    }


    shifts.splice(
        editingShiftIndex,
        1
    );


    /*
     * Якщо більше немає змін
     * цього дня — прибираємо день.
     */

    if (shifts.length === 0) {

        delete data.shifts[
            selectedDate
        ];
    }


    saveData();

    closeShiftModal();

    renderCalendar();
}


/* =========================================================
   ЗАКРИТИ МОДАЛКУ ЗМІНИ
========================================================= */

function closeShiftModal() {

    if (shiftModal) {

        shiftModal.classList.remove(
            "active"
        );
    }


    selectedDate = null;

    editingShiftIndex = null;
}


/* =========================================================
   ДОДАТИ ПРАЦІВНИКА
========================================================= */

function addEmployee() {

    if (!employeeInput) {
        return;
    }


    const name =
        employeeInput.value.trim();


    if (!name) {

        alert(
            "Введи ім'я працівника."
        );


        return;
    }


    /*
     * Перевірка на дублікати.
     */

    const exists =
        data.employees.some(
            employee =>
                employee.toLowerCase() ===
                name.toLowerCase()
        );


    if (exists) {

        alert(
            "Такий працівник уже є."
        );


        return;
    }


    /*
     * Додаємо працівника
     * у поточний список.
     */

    data.employees.push(
        name
    );


    /*
     * Одразу зберігаємо
     * localStorage + Firebase.
     */

    saveData();


    employeeInput.value = "";


    renderEmployees();
}


/* =========================================================
   ВИДАЛИТИ ПРАЦІВНИКА
========================================================= */

let employeeToDeleteIndex = null;


/* =========================================
   ВІДКРИТИ ВІКНО ВИДАЛЕННЯ
========================================= */

function deleteEmployee(index) {

    const employee =
        data.employees[index];

    if (!employee) {
        return;
    }

    employeeToDeleteIndex = index;

    deleteEmployeeText.textContent =
        `Видалити працівника "${employee}" зі списку?`;

    deleteEmployeeModal.classList.add(
        "active"
    );
}


/* =========================================
   ПІДТВЕРДИТИ ВИДАЛЕННЯ
========================================= */

function confirmDeleteEmployee() {

    if (
        employeeToDeleteIndex === null
    ) {
        return;
    }

    data.employees.splice(
        employeeToDeleteIndex,
        1
    );

    saveData();

    renderEmployees();

    renderCalendar();

    closeDeleteEmployeeModal();
}


/* =========================================
   ЗАКРИТИ ВІКНО
========================================= */

function closeDeleteEmployeeModal() {

    deleteEmployeeModal.classList.remove(
        "active"
    );

    employeeToDeleteIndex = null;
}


/* =========================================================
   ПОПЕРЕДНІЙ МІСЯЦЬ
========================================================= */

if (prevMonth) {

    prevMonth.addEventListener(
        "click",
        function() {

            currentDate =
                new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() - 1,
                    1
                );


            renderCalendar();
        }
    );
}


/* =========================================================
   НАСТУПНИЙ МІСЯЦЬ
========================================================= */

if (nextMonth) {

    nextMonth.addEventListener(
        "click",
        function() {

            currentDate =
                new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() + 1,
                    1
                );


            renderCalendar();
        }
    );
}


/* =========================================================
   СЬОГОДНІ
========================================================= */

if (todayButton) {

    todayButton.addEventListener(
        "click",
        function() {

            currentDate =
                new Date();


            renderCalendar();
        }
    );
}


/* =========================================================
   ЗМІНА — КНОПКИ
========================================================= */

if (saveShiftButton) {

    saveShiftButton.addEventListener(
        "click",
        saveShift
    );
}


if (deleteShiftButton) {

    deleteShiftButton.addEventListener(
        "click",
        deleteShift
    );
}


if (closeShiftModalButton) {

    closeShiftModalButton.addEventListener(
        "click",
        closeShiftModal
    );
}


/* =========================================================
   КЛІК ПО ФОНУ МОДАЛКИ ЗМІНИ
========================================================= */

if (shiftModal) {

    shiftModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                shiftModal
            ) {

                closeShiftModal();
            }
        }
    );
}


/* =========================================================
   ВІДКРИТИ ПРАЦІВНИКІВ
========================================================= */

if (employeesButton) {

    employeesButton.addEventListener(
        "click",
        function() {

            renderEmployees();


            if (employeesModal) {

                employeesModal.classList.add(
                    "active"
                );
            }
        }
    );
}


/* =========================================================
   ЗАКРИТИ ПРАЦІВНИКІВ
========================================================= */

if (closeEmployeesModal) {

    closeEmployeesModal.addEventListener(
        "click",
        function() {

            if (employeesModal) {

                employeesModal.classList.remove(
                    "active"
                );
            }
        }
    );
}


/* =========================================================
   КЛІК ПО ФОНУ МОДАЛКИ ПРАЦІВНИКІВ
========================================================= */

if (employeesModal) {

    employeesModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                employeesModal
            ) {

                employeesModal.classList.remove(
                    "active"
                );
            }
        }
    );
}


/* =========================================================
   ДОДАТИ ПРАЦІВНИКА
========================================================= */

if (addEmployeeButton) {

    addEmployeeButton.addEventListener(
        "click",
        addEmployee
    );
}


/* =========================================================
   ENTER — ДОДАТИ ПРАЦІВНИКА
========================================================= */

if (employeeInput) {

    employeeInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter"
            ) {

                addEmployee();
            }
        }
    );
}

/* =========================================
   ВИДАЛЕННЯ ПРАЦІВНИКА
========================================= */

confirmDeleteEmployeeButton.addEventListener(
    "click",
    confirmDeleteEmployee
);


cancelDeleteEmployeeButton.addEventListener(
    "click",
    closeDeleteEmployeeModal
);


cancelDeleteEmployeeButton2.addEventListener(
    "click",
    closeDeleteEmployeeModal
);


/* Закрити по фону */

deleteEmployeeModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target === deleteEmployeeModal
        ) {

            closeDeleteEmployeeModal();

        }

    }
);

/* =========================================================
   ESC
========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Escape"
        ) {

            closeShiftModal();
            closeDeleteEmployeeModal();


            if (employeesModal) {

                employeesModal.classList.remove(
                    "active"
                );
            }
        }
    }
);


/* =========================================================
   ПОЧАТКОВИЙ ЗАПУСК
========================================================= */

/*
 * Спочатку показуємо локальні дані,
 * щоб сторінка не була порожньою.
 */

renderStores();

renderEmployees();

renderCalendar();


/*
 * Потім підключаємо Firebase.
 *
 * Firebase завантажить актуальні дані
 * і буде постійно синхронізувати їх.
 */

initFirebase();
/* =========================================================
   ВИБІР ОСОБИСТОГО ГРАФІКА ПРАЦІВНИКА
   ========================================================= */

(function () {

    const PROFILE_KEY = "selectedWorkEmployee";

    let selectedEmployee =
        localStorage.getItem(PROFILE_KEY) || "";

    let profileSelect = null;
    let profileName = null;


    /* =========================================================
       СТВОРЕННЯ ВИБОРУ ПРАЦІВНИКА
       ========================================================= */

    function createEmployeeSwitcher() {

        if (document.getElementById("profileEmployeeSelect")) {
            return;
        }

        const employeesButton =
            document.getElementById("employeesButton");

        if (!employeesButton) {
            return;
        }

        const header =
            employeesButton.closest(".header");

        if (!header) {
            return;
        }

        /* Контейнер справа */

        const actions =
            document.createElement("div");

        actions.className =
            "header-actions";

        /* Перемикач */

        const switcher =
            document.createElement("div");

        switcher.className =
            "profile-switcher";

        const label =
            document.createElement("span");

        label.textContent =
            "Графік:";

        profileSelect =
            document.createElement("select");

        profileSelect.id =
            "profileEmployeeSelect";

        switcher.appendChild(label);
        switcher.appendChild(profileSelect);

        /* Назва під заголовком */

        const headerText =
            header.querySelector("div");

        if (headerText) {

            profileName =
                document.createElement("div");

            profileName.className =
                "current-profile-name";

            headerText.appendChild(profileName);
        }

        /* Переносимо кнопку працівників */

        header.insertBefore(
            actions,
            employeesButton
        );

        actions.appendChild(switcher);
        actions.appendChild(employeesButton);


        /* Зміна працівника */

        profileSelect.addEventListener(
            "change",
            function () {

                selectedEmployee =
                    profileSelect.value;

                localStorage.setItem(
                    PROFILE_KEY,
                    selectedEmployee
                );

                updateProfileName();

                /* У вікні додавання зміни */

                if (employeeSelect) {
                    employeeSelect.value =
                        selectedEmployee;
                }

                /* Перемальовуємо календар */

                renderCalendar();
            }
        );
    }


    /* =========================================================
       ОНОВЛЕННЯ СПИСКУ
       ========================================================= */

    function updateEmployeeSwitcher() {

        if (!profileSelect) {
            return;
        }

        profileSelect.innerHTML = "";

        if (!Array.isArray(data.employees)) {
            return;
        }

        /* Якщо збережений працівник ще існує */

        if (
            selectedEmployee &&
            data.employees.includes(selectedEmployee)
        ) {

            /* залишаємо його */

        } else {

            /* Перший працівник за замовчуванням */

            selectedEmployee =
                data.employees[0] || "";

            if (selectedEmployee) {

                localStorage.setItem(
                    PROFILE_KEY,
                    selectedEmployee
                );
            }
        }

        data.employees.forEach(
            function (employee) {

                const option =
                    document.createElement("option");

                option.value =
                    employee;

                option.textContent =
                    employee;

                profileSelect.appendChild(
                    option
                );
            }
        );

        profileSelect.value =
            selectedEmployee;

        if (employeeSelect) {

            employeeSelect.value =
                selectedEmployee;
        }

        updateProfileName();
    }


    /* =========================================================
       НАЗВА ГРАФІКА
       ========================================================= */

    function updateProfileName() {

        if (!profileName) {
            return;
        }

        if (selectedEmployee) {

            profileName.textContent =
                "Особистий графік: " +
                selectedEmployee;

        } else {

            profileName.textContent =
                "Оберіть працівника";
        }
    }


    /* =========================================================
       ЗАПАМ'ЯТОВУЄМО ВИБІР
       ========================================================= */

    const oldRenderEmployees =
        renderEmployees;

    renderEmployees =
        function () {

            oldRenderEmployees();

            createEmployeeSwitcher();

            updateEmployeeSwitcher();
        };


    /* =========================================================
       ПОКАЗУЄМО ТІЛЬКИ ОБРАНОГО ПРАЦІВНИКА
       ========================================================= */

    const oldRenderCalendar =
        renderCalendar;

    renderCalendar =
        function () {

            oldRenderCalendar();

            if (!selectedEmployee) {
                return;
            }

            const shifts =
                document.querySelectorAll(".shift");

            shifts.forEach(
                function (shiftElement) {

                    const employeeElement =
                        shiftElement.querySelector(
                            ".shift-employee"
                        );

                    const employee =
                        employeeElement
                            ? employeeElement.textContent.trim()
                            : "";

                    if (
                        employee === selectedEmployee
                    ) {

                        shiftElement.style.display =
                            "";

                    } else {

                        shiftElement.style.display =
                            "none";
                    }
                }
            );
        };


    /* =========================================================
       ПРИ ДОДАВАННІ ЗМІНИ —
       АВТОМАТИЧНО ПОТОЧНИЙ ПРАЦІВНИК
       ========================================================= */

    if (calendar) {

        calendar.addEventListener(
            "click",
            function () {

                if (
                    employeeSelect &&
                    selectedEmployee
                ) {

                    employeeSelect.value =
                        selectedEmployee;
                }
            },
            true
        );
    }


    /* =========================================================
       ЗАПУСК
       ========================================================= */

    createEmployeeSwitcher();

    updateEmployeeSwitcher();

    renderCalendar();

})();
