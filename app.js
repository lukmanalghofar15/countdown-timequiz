// ==========================================
// 1. INISIALISASI FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDponZeUwnM05SBXO1Im-GO_O2Z8uPIEJE",
  authDomain: "countdown-time-quiz.firebaseapp.com",
  projectId: "countdown-time-quiz",
  storageBucket: "countdown-time-quiz.firebasestorage.app",
  messagingSenderId: "768125638914",
  appId: "1:768125638914:web:02b636a44f8274a3474a1b",
  measurementId: "G-440ZXJDW08"
};

// Inisialisasi Firebase & Firestore menggunakan objek window (dari CDN HTML)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 2. AUTH DOSEN
// ==========================================
let isRegisterMode = false;

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

    const userRef = db.collection('dosen').doc(email);

    if(isRegisterMode) {
        userRef.set({ password: pass }).then(() => {
            alert("Pendaftaran berhasil! Silakan login.");
            toggleMode();
        });
    } else {
        userRef.get().then((doc) => {
            if (doc.exists && doc.data().password === pass) {
                localStorage.setItem('loggedUser', email);
                window.location.href = "dashboard.html";
            } else {
                alert("Email atau password salah!");
            }
        });
    }
}

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = "auth.html";
}

// ==========================================
// 3. DASHBOARD DOSEN (Menyimpan & Membaca ke Cloud Firestore)
// ==========================================
function createQuiz() {
    const title = document.getElementById('quizTitle').value;
    const url = document.getElementById('quizUrl').value;
    const duration = document.getElementById('quizDuration').value;

    if(!title || !url || !duration) { alert("Semua field wajib diisi!"); return; }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    db.collection("quizzes").add({
        title: title,
        url: url,
        duration: parseInt(duration),
        pin: pin,
        active: true,
        dosen: localStorage.getItem('loggedUser'),
        submissions: []
    }).then(() => {
        alert(`Kuis berhasil dibuat! PIN Akses: ${pin}`);
        document.getElementById('quizTitle').value = '';
        document.getElementById('quizUrl').value = '';
        document.getElementById('quizDuration').value = '';
        loadDashboard();
    });
}

function loadDashboard() {
    const container = document.getElementById('quizListContainer');
    if(!container) return;

    const dosenEmail = localStorage.getItem('loggedUser');
    if(!dosenEmail) { window.location.href = "auth.html"; return; }

    container.innerHTML = '<p class="text-gray-500">Memuat data dari server...</p>';

    db.collection("quizzes").where("dosen", "==", dosenEmail)
    .onSnapshot((querySnapshot) => {
        if(querySnapshot.empty) {
            container.innerHTML = `<p class="text-gray-500 text-sm">Belum ada kuis yang dibuat.</p>`;
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const q = doc.data();
            html += `
            <div class="border border-gray-200 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 bg-white">
                <div>
                    <h4 class="font-bold text-lg">${q.title}</h4>
                    <p class="text-sm text-gray-500">Durasi: ${q.duration} Menit | PIN: <span class="font-mono font-bold text-slate-900">${q.pin}</span></p>
                    <p class="text-xs text-gray-400 mt-1">Total Mahasiswa Submit: ${q.submissions.length} orang</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${q.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${q.active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                    <button onclick="toggleQuizStatus('${doc.id}', ${q.active})" class="text-xs border px-3 py-1 rounded hover:bg-gray-50">Ubah Status</button>
                    <button onclick="viewSubmissions('${doc.id}')" class="text-xs bg-slate-100 px-3 py-1 rounded hover:bg-slate-200">Data Submit</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    });
}

function toggleQuizStatus(docId, currentStatus) {
    db.collection("quizzes").doc(docId).update({
        active: !currentStatus
    });
}

function viewSubmissions(docId) {
    db.collection("quizzes").doc(docId).get().then((doc) => {
        const subs = doc.data().submissions;
        if(subs.length === 0) {
            alert("Belum ada mahasiswa yang mengumpulkan kuis ini.");
        } else {
            let list = subs.map((s, idx) => `${idx+1}. ${s.name} (${s.niu})`).join('\n');
            alert(`Daftar Mahasiswa yang Mengumpulkan:\n\n` + list);
        }
    });
}

// ==========================================
// 4. PORTAL MAHASISWA
// ==========================================
function verifyStudentPin() {
    const pin = document.getElementById('studentPin').value;
    
    db.collection("quizzes").where("pin", "==", pin).where("active", "==", true).get()
    .then((querySnapshot) => {
        if (querySnapshot.empty) {
            alert("PIN salah atau kuis sedang ditutup!");
            return;
        }

        const doc = querySnapshot.docs[0];
        const quizData = doc.data();
        quizData.id = doc.id; 

        localStorage.setItem('currentQuizSession', JSON.stringify(quizData));
        document.getElementById('stepPin').classList.add('hidden');
        document.getElementById('stepIdentity').classList.remove('hidden');
        document.getElementById('activeQuizName').innerText = quizData.title;
    });
}

function startQuizSession() {
    const name = document.getElementById('studentName').value;
    const niu = document.getElementById('studentNiu').value;

    if(!name || !niu) { alert("Nama dan NIU wajib diisi!"); return; }

    const quizSession = JSON.parse(localStorage.getItem('currentQuizSession'));
    const quizRef = db.collection("quizzes").doc(quizSession.id);

    quizRef.get().then((doc) => {
        const data = doc.data();
        const alreadySubmitted = data.submissions.some(s => s.niu === niu);

        if(alreadySubmitted) {
            alert("Maaf, NIU ini sudah pernah digunakan untuk submit kuis ini (Satu NIU hanya 1 kali submit).");
            return;
        }

        const newSubmission = { name: name, niu: niu, time: new Date().toISOString() };
        quizRef.update({
            submissions: firebase.firestore.FieldValue.arrayUnion(newSubmission)
        }).then(() => {
            localStorage.setItem('activeStudent', JSON.stringify({ name, niu }));
            window.location.href = "quiz.html";
        });
    });
}

// ==========================================
// 5. HALAMAN KUIS & TIMER (DIPERBARUI)
// ==========================================
let timerInterval; // Variabel global untuk timer agar bisa dihentikan kapan saja

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

    // --- SOLUSI 1: WAKTU TETAP BERJALAN SAAT REFRESH ---
    let endTime = localStorage.getItem('quizEndTime');
    if (!endTime) {
        // Jika kuis baru pertama kali dimulai, catat "waktu selesai"-nya ke memori browser
        const durationInMs = quiz.duration * 60 * 1000;
        endTime = new Date().getTime() + durationInMs;
        localStorage.setItem('quizEndTime', endTime);
    }

    // Cek sisa waktu saat ini
    const now = new Date().getTime();
    const remainingSeconds = Math.floor((endTime - now) / 1000);

    if (remainingSeconds <= 0) {
        endQuizSession(); // Jika saat direfresh waktu ternyata sudah habis
    } else {
        startCountdown(endTime); // Jalankan timer berdasarkan waktu selesai absolut
    }

    // --- SOLUSI 2: DETEKSI PINDAH TAB (ANTI-CHEAT) ---
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'hidden') {
            // Ketika user pindah tab, minimize browser, atau buka aplikasi lain
            alert("⛔ PELANGGARAN: Anda terdeteksi keluar dari halaman kuis (membuka tab/aplikasi lain). Ujian otomatis dihentikan!");
            endQuizSession();
        }
    });
}

function startCountdown(endTime) {
    const display = document.getElementById('timerDisplay');

    timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;

        if (distance <= 0) {
            endQuizSession();
            return;
        }

        // Hitung menit dan detik yang tersisa
        let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((distance % (1000 * 60)) / 1000);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.innerText = `${minutes}:${seconds}`;
    }, 1000);
}

// Fungsi khusus untuk mengakhiri kuis & mengunci layar
function endQuizSession() {
    if(timerInterval) clearInterval(timerInterval); // Hentikan perhitungan
    document.getElementById('formContainer').classList.add('hidden'); // Sembunyikan form
    document.getElementById('timeoutMessage').classList.remove('hidden'); // Munculkan pesan selesai
    
    // Bersihkan sesi ujian dari browser agar tidak bisa diakses lagi
    localStorage.removeItem('currentQuizSession');
    localStorage.removeItem('activeStudent');
    localStorage.removeItem('quizEndTime'); 
}
