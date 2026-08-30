const firebaseConfig = {
  apiKey: "AIzaSyDponZeUwnM05SBX0lIm-GO_O2Z8uPIEJE",
  authDomain: "countdown-time-quiz.firebaseapp.com",
  projectId: "countdown-time-quiz",
  storageBucket: "countdown-time-quiz.firebasestorage.app",
  messagingSenderId: "768125638914",
  appId: "1:768125638914:web:02b636a44f8274a3474a1b",
  measurementId: "G-440ZXJDW08"
};

let isRegisterMode = false;

// --- AUTH DOSEN ---
function toggleMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('formTitle').innerText = isRegisterMode ? "Daftar Akun Dosen" : "Login Dosen";
    document.getElementById('submitBtn').innerText = isRegisterMode ? "Daftar" : "Masuk";
    document.getElementById('toggleText').innerText = isRegisterMode ? "Sudah punya akun?" : "Belum punya akun?";
}

function handleAuth() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    if(!email || !pass) { alert("Isi semua kolom!"); return; }

    if(isRegisterMode) {
        localStorage.setItem('user_' + email, pass);
        alert("Pendaftaran berhasil! Silakan login.");
        toggleMode();
    } else {
        const savedPass = localStorage.getItem('user_' + email);
        if(savedPass === pass) {
            localStorage.setItem('loggedUser', email);
            window.location.href = "dashboard.html";
        } else {
            alert("Email atau password salah!");
        }
    }
}

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = "auth.html";
}

// --- DASHBOARD DOSEN ---
function createQuiz() {
    const title = document.getElementById('quizTitle').value;
    const url = document.getElementById('quizUrl').value;
    const duration = document.getElementById('quizDuration').value;

    if(!title || !url || !duration) { alert("Semua field wajib diisi!"); return; }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');

    const newQuiz = {
        id: Date.now(),
        title,
        url,
        duration: parseInt(duration),
        pin,
        active: true,
        submissions: [] // Menyimpan daftar NIU yang sudah submit
    };

    quizzes.push(newQuiz);
    localStorage.setItem('quizzes', JSON.stringify(quizzes));
    alert(`Kuis berhasil dibuat! PIN Akses: ${pin}`);
    loadDashboard();
}

function loadDashboard() {
    const container = document.getElementById('quizListContainer');
    if(!container) return;
    const quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');

    if(quizzes.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm">Belum ada kuis yang dibuat.</p>`;
        return;
    }

    container.innerHTML = quizzes.map(q => `
        <div class="border border-gray-200 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h4 class="font-bold text-lg">${q.title}</h4>
                <p class="text-sm text-gray-500">Durasi: ${q.duration} Menit | PIN: <span class="font-mono font-bold text-slate-900">${q.pin}</span></p>
                <p class="text-xs text-gray-400 mt-1">Total Mahasiswa Submit: ${q.submissions.length} orang</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="px-3 py-1 rounded-full text-xs font-medium ${q.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${q.active ? 'Aktif' : 'Non-Aktif'}
                </span>
                <button onclick="toggleQuizStatus(${q.id})" class="text-xs border px-3 py-1 rounded hover:bg-gray-50">Ubah Status</button>
                <button onclick="viewSubmissions(${q.id})" class="text-xs bg-slate-100 px-3 py-1 rounded hover:bg-slate-200">Lihat Data Submit</button>
            </div>
        </div>
    `).join('');
}

function toggleQuizStatus(id) {
    let quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');
    quizzes = quizzes.map(q => { if(q.id === id) q.active = !q.active; return q; });
    localStorage.setItem('quizzes', JSON.stringify(quizzes));
    loadDashboard();
}

function viewSubmissions(id) {
    const quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');
    const q = quizzes.find(item => item.id === id);
    if(q.submissions.length === 0) {
        alert("Belum ada mahasiswa yang mengumpulkan kuis ini.");
    } else {
        let list = q.submissions.map((s, idx) => `${idx+1}. ${s.name} (${s.niu})`).join('\n');
        alert(`Daftar Mahasiswa yang Mengumpulkan:\n\n` + list);
    }
}

// --- PORTAL MAHASISWA ---
function verifyStudentPin() {
    const pin = document.getElementById('studentPin').value;
    const quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');
    const quiz = quizzes.find(q => q.pin === pin && q.active);

    if(!quiz) {
        alert("PIN salah atau kuis sedang tidak aktif!");
        return;
    }

    // Simpan sementara sesi kuis mahasiswa
    localStorage.setItem('currentQuizSession', JSON.stringify(quiz));
    document.getElementById('stepPin').classList.add('hidden');
    document.getElementById('stepIdentity').classList.remove('hidden');
    document.getElementById('activeQuizName').innerText = quiz.title;
}

function startQuizSession() {
    const name = document.getElementById('studentName').value;
    const niu = document.getElementById('studentNiu').value;

    if(!name || !niu) { alert("Nama dan NIU wajib diisi!"); return; }

    const quiz = JSON.parse(localStorage.getItem('currentQuizSession'));
    let quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');
    const currentQuiz = quizzes.find(q => q.id === quiz.id);

    // Cek apakah NIU sudah pernah submit
    const alreadySubmitted = currentQuiz.submissions.some(s => s.niu === niu);
    if(alreadySubmitted) {
        alert("Maaf, NIU ini sudah pernah digunakan untuk submit kuis ini (Satu NIU hanya 1 kali submit).");
        return;
    }

    // Catat submit mahasiswa ke database kuis
    currentQuiz.submissions.push({ name, niu, time: new Date().toLocaleTimeString() });
    localStorage.setItem('quizzes', JSON.stringify(quizzes));

    // Simpan data aktif mahasiswa untuk halaman kuis
    localStorage.setItem('activeStudent', JSON.stringify({ name, niu }));
    window.location.href = "quiz.html";
}

// --- HALAMAN KUIS & TIMER ---
function initQuizPage() {
    const quiz = JSON.parse(localStorage.getItem('currentQuizSession'));
    const student = JSON.parse(localStorage.getItem('activeStudent'));

    if(!quiz || !student) {
        window.location.href = "student.html";
        return;
    }

    document.getElementById('quizTitleHeader').innerText = quiz.title;
    document.getElementById('studentInfo').innerText = `${student.name} (${student.niu})`;
    document.getElementById('gformIframe').src = quiz.url;

    // Jalankan Timer Mundur (dalam detik)
    startCountdown(quiz.duration * 60);
}

function startCountdown(durationInSeconds) {
    let timer = durationInSeconds;
    const display = document.getElementById('timerDisplay');

    const interval = setInterval(() => {
        let minutes = Math.floor(timer / 60);
        let seconds = timer % 60;

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.innerText = `${minutes}:${seconds}`;

        if (--timer < 0) {
            clearInterval(interval);
            document.getElementById('formContainer').classList.add('hidden');
            document.getElementById('timeoutMessage').classList.remove('hidden');
            localStorage.removeItem('currentQuizSession');
        }
    }, 1000);
}
