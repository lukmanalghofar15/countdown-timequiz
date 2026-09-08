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
    document.getElementById('formTitle').innerText = isRegisterMode ? "Daftar Akun" : "Login";
    document.getElementById('submitBtn').innerText = isRegisterMode ? "Daftar" : "Masuk";
    document.getElementById('toggleText').innerText = isRegisterMode ? "Sudah punya akun?" : "Belum punya akun?";
}

function handleAuth() {
    const email = document.getElementById('email').value.toLowerCase().trim();
    const pass = document.getElementById('password').value;
    
    if(!email || !pass) { alert("Isi semua kolom!"); return; }

    const userRef = db.collection('dosen').doc(email);

    if(isRegisterMode) {
        userRef.get().then((doc) => {
            if (doc.exists) {
                alert("Email ini sudah terdaftar! Silakan login.");
            } else {
                userRef.set({ password: pass }).then(() => {
                    alert("Pendaftaran berhasil! Silakan login menggunakan email dan password Anda.");
                    toggleMode();
                }).catch(err => alert("Error Database: " + err.message)); // Mencegah buffering
            }
        }).catch(err => alert("Koneksi gagal: " + err.message));
    } else {
        userRef.get().then((doc) => {
            if (doc.exists && doc.data().password === pass) {
                localStorage.setItem('loggedUser', email);
                window.location.href = "dashboard.html";
            } else {
                alert("Login Gagal: Email tidak terdaftar atau password salah!");
            }
        }).catch(err => alert("Koneksi gagal: " + err.message));
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
    
    // 1. TAMBAHAN BARU: Menangkap pilihan jadwal kelas
    const classType = document.getElementById('quizClassType').value; 

    if(!title || !url || !duration) { alert("Semua field wajib diisi!"); return; }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    db.collection("quizzes").add({
        title: title,
        url: url,
        duration: parseInt(duration),
        pin: pin,
        active: true,
        classType: classType, // 2. TAMBAHAN BARU: Menyimpan pilihan kelas ke database
        dosen: localStorage.getItem('loggedUser'),
        submissions: []
    }).then(() => {
        alert(`Kuis berhasil dibuat! PIN Akses: ${pin}`);
        document.getElementById('quizTitle').value = '';
        document.getElementById('quizUrl').value = '';
        document.getElementById('quizDuration').value = '';
        
        // 3. TAMBAHAN BARU: Mengembalikan dropdown ke "Tanpa Jadwal" setelah kuis terbuat
        document.getElementById('quizClassType').value = 'none'; 
        
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
            // Penambahan fallback jika q.submissions belum ada
            const totalSubmissions = q.submissions ? q.submissions.length : 0; 
            
            html += `
            <div class="border border-gray-200 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 bg-white">
                <div>
                    <h4 class="font-bold text-lg">${q.title}</h4>
                    <p class="text-sm text-gray-500">Durasi: ${q.duration} Menit | PIN: <span class="font-mono font-bold text-slate-900">${q.pin}</span></p>
                    <p class="text-xs text-gray-400 mt-1">Total Mahasiswa Submit: ${totalSubmissions} orang</p>
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
        
    }, (error) => {
        // FITUR BARU: Menangkap dan menampilkan error ke layar agar tidak buffering terus
        console.error("Firebase Error:", error);
        container.innerHTML = `<div class="bg-red-50 p-4 rounded-lg border border-red-200">
            <h4 class="text-red-700 font-bold mb-1">Gagal Memuat Data</h4>
            <p class="text-red-600 text-sm">${error.message}</p>
        </div>`;
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
// 5. HALAMAN KUIS & TIMER (FINAL)
// ==========================================
let timerInterval;
let isUnloading = false; // Penanda untuk membedakan refresh dan pindah tab

// Event ini akan aktif tepat sebelum halaman di-refresh atau ditutup
window.addEventListener('beforeunload', () => {
    isUnloading = true; 
});

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

    let endTime = localStorage.getItem('quizEndTime');
    if (!endTime) {
        const durationInMs = quiz.duration * 60 * 1000;
        endTime = new Date().getTime() + durationInMs;
        localStorage.setItem('quizEndTime', endTime);
    }

    const now = new Date().getTime();
    const remainingSeconds = Math.floor((endTime - now) / 1000);

    if (remainingSeconds <= 0) {
        endQuizSession();
    } else {
        startCountdown(endTime);
    }

    // --- FITUR ANTI-CHEAT YANG DIPERBAIKI ---
    document.addEventListener("visibilitychange", () => {
        // Jika tab disembunyikan DAN bukan karena proses refresh halaman
        if (document.visibilityState === 'hidden' && !isUnloading) {
            alert("⛔ PELANGGARAN: Anda terdeteksi keluar dari halaman kuis. Ujian otomatis dihentikan!");
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

        let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // FITUR PERINGATAN 1 MENIT TERAKHIR
        if (minutes === 0 && seconds <= 59) {
            display.classList.add('text-red-600', 'animate-pulse');
            // Tambahkan tulisan peringatan di sebelah waktu
            document.getElementById('quizTitleHeader').innerHTML = `<span class="text-red-400 animate-pulse">⚠️ SEGERA SUBMIT SEBELUM WAKTU HABIS!</span>`;
        }

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.innerText = `${minutes}:${seconds}`;
    }, 1000);
}

function endQuizSession() {
    if(timerInterval) clearInterval(timerInterval);
    document.getElementById('formContainer').classList.add('hidden');
    document.getElementById('timeoutMessage').classList.remove('hidden');
    
    // Jangan hapus activeStudent jika ingin merekam log pelanggaran di masa depan, 
    // tapi untuk sekarang kita bersihkan agar form benar-benar terkunci.
    localStorage.removeItem('currentQuizSession');
    localStorage.removeItem('activeStudent');
    localStorage.removeItem('quizEndTime'); 
}

// ==========================================
// KONFIRMASI SUBMIT MANUAL
// ==========================================

function handleEarlySubmit() {
    // 1. Hentikan timer
    if(timerInterval) clearInterval(timerInterval);
    
    // 2. Matikan fitur anti-cheat agar aman saat keluar
    isUnloading = true; 
    
    // 3. Sembunyikan form dan tombol konfirmasi
    document.getElementById('formContainer').classList.add('hidden');
    
    // 4. Tampilkan pesan berhasil
    const timeoutMsg = document.getElementById('timeoutMessage');
    timeoutMsg.classList.remove('hidden');
    timeoutMsg.innerHTML = `
        <h2 class="text-3xl font-bold text-green-600 mb-2">Terima Kasih!</h2>
        <p class="text-gray-600 mb-6">Jawaban kuis Anda telah selesai dan sesi pengerjaan ditutup.</p>
        <a href="index.html" class="bg-slate-900 text-white px-6 py-3 rounded-full font-medium">Kembali ke Beranda</a>
    `;
    
    // 5. Kunci kuis agar tidak bisa diulang
    localStorage.removeItem('currentQuizSession');
    localStorage.removeItem('activeStudent');
    localStorage.removeItem('quizEndTime');
}

// ==========================================
// 6. FITUR REKAP NILAI (DIPERBARUI DENGAN EDIT)
// ==========================================
let editingGradeId = null; // Penanda jika sedang mengedit data

function addComponentRow() {
    const container = document.getElementById('componentsContainer');
    const row = document.createElement('div');
    row.className = "flex gap-2 component-row mt-3";
    row.innerHTML = `
        <input type="text" class="comp-name w-1/2 px-3 py-2 border rounded bg-gray-50" placeholder="Nama (cth: Laporan)">
        <input type="number" class="comp-score w-1/4 px-3 py-2 border rounded bg-gray-50" placeholder="Nilai">
        <input type="number" class="comp-weight w-1/4 px-3 py-2 border rounded bg-gray-50" placeholder="Bobot (%)">
        <button onclick="this.parentElement.remove()" class="text-red-500 font-bold px-2">X</button>
    `;
    container.appendChild(row);
}

function saveGrade() {
    const practicumTitle = document.getElementById('practicumTitle').value.trim();
    const studentName = document.getElementById('studentNameGrade').value.trim();
    const studentNiu = document.getElementById('studentNiuGrade').value.trim();

    if(!practicumTitle || !studentName || !studentNiu) {
        alert("Judul, Nama, dan NIM wajib diisi!"); return;
    }

    const rows = document.querySelectorAll('.component-row');
    let components = [];
    let totalWeight = 0;
    let finalScore = 0;

    for (let row of rows) {
        const name = row.querySelector('.comp-name').value;
        const score = parseFloat(row.querySelector('.comp-score').value) || 0;
        const weight = parseFloat(row.querySelector('.comp-weight').value) || 0;

        if (name) {
            components.push({ name, score, weight });
            totalWeight += weight;
            finalScore += (score * (weight / 100)); 
        }
    }

    if (totalWeight !== 100) {
        alert(`Peringatan: Total bobot rasio saat ini adalah ${totalWeight}%. Harus tepat 100%.`);
        return;
    }

    const dosenEmail = localStorage.getItem('loggedUser');

    if (editingGradeId) {
        // --- MODE UPDATE / EDIT DATA ---
        db.collection("grades").doc(editingGradeId).update({
            practicumTitle: practicumTitle.toLowerCase(),
            studentName: studentName.toLowerCase(),
            studentNiu: studentNiu.toLowerCase(),
            components: components,
            finalScore: parseFloat(finalScore.toFixed(2))
        }).then(() => {
            alert("Data nilai berhasil diperbarui!");
            resetGradeForm();
        }).catch(err => alert("Gagal memperbarui: " + err.message));
    } else {
        // --- MODE TAMBAH DATA BARU ---
        db.collection("grades").add({
            dosen: dosenEmail,
            practicumTitle: practicumTitle.toLowerCase(),
            studentName: studentName.toLowerCase(),
            studentNiu: studentNiu.toLowerCase(),
            components: components,
            finalScore: parseFloat(finalScore.toFixed(2)),
            timestamp: new Date().toISOString()
        }).then(() => {
            alert("Data nilai berhasil disimpan!");
            resetGradeForm();
        }).catch(err => alert("Gagal menyimpan: " + err.message));
    }
}

function loadGrades() {
    const tbody = document.getElementById('gradesTableBody');
    if(!tbody) return;

    const dosenEmail = localStorage.getItem('loggedUser');
    if(!dosenEmail) return;

    // Kueri aman tanpa orderBy server untuk mencegah error indeks
    db.collection("grades").where("dosen", "==", dosenEmail)
    .onSnapshot((snapshot) => {
        tbody.innerHTML = '';
        if(snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-gray-500">Belum ada data nilai.</td></tr>`;
            return;
        }

        let grades = [];
        snapshot.forEach((doc) => {
            grades.push({ id: doc.id, ...doc.data() });
        });

        // Urutkan data secara lokal di browser (terbaru di atas)
        grades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        grades.forEach((data) => {
            tbody.innerHTML += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 capitalize">${data.practicumTitle}</td>
                <td class="p-3 capitalize">${data.studentName}<br><span class="text-xs text-gray-500 uppercase">${data.studentNiu}</span></td>
                <td class="p-3 text-center font-bold text-blue-600">${data.finalScore}</td>
                <td class="p-3 text-center space-x-2">
                    <button onclick="editGrade('${data.id}')" class="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200 font-medium">Edit</button>
                    <button onclick="deleteGrade('${data.id}')" class="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-medium">Hapus</button>
                </td>
            </tr>`;
        });
    }, (error) => {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-red-500">Gagal memuat: ${error.message}</td></tr>`;
    });
}

function editGrade(id) {
    db.collection("grades").doc(id).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('practicumTitle').value = data.practicumTitle;
            document.getElementById('studentNameGrade').value = data.studentName;
            document.getElementById('studentNiuGrade').value = data.studentNiu;

            // Masukkan kembali komponen penilaian ke form
            const container = document.getElementById('componentsContainer');
            container.innerHTML = '';
            data.components.forEach(c => {
                const row = document.createElement('div');
                row.className = "flex gap-2 component-row mt-3";
                row.innerHTML = `
                    <input type="text" class="comp-name w-1/2 px-3 py-2 border rounded bg-gray-50" value="${c.name}">
                    <input type="number" class="comp-score w-1/4 px-3 py-2 border rounded bg-gray-50" value="${c.score}">
                    <input type="number" class="comp-weight w-1/4 px-3 py-2 border rounded bg-gray-50" value="${c.weight}">
                    <button onclick="this.parentElement.remove()" class="text-red-500 font-bold px-2">X</button>
                `;
                container.appendChild(row);
            });

            editingGradeId = id;
            
            // Ubah tombol simpan menjadi tombol update berwarna kuning
            const saveBtn = document.querySelector('button[onclick="saveGrade()"]');
            saveBtn.innerText = "Perbarui Nilai";
            saveBtn.className = "bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-yellow-700";
            
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Otomatis scroll ke atas melihat form
        }
    });
}

function resetGradeForm() {
    document.getElementById('practicumTitle').value = '';
    document.getElementById('studentNameGrade').value = '';
    document.getElementById('studentNiuGrade').value = '';
    document.getElementById('componentsContainer').innerHTML = `
        <div class="flex gap-2 component-row">
            <input type="text" class="comp-name w-1/2 px-3 py-2 border rounded bg-gray-50" placeholder="Nama (cth: Laporan)">
            <input type="number" class="comp-score w-1/4 px-3 py-2 border rounded bg-gray-50" placeholder="Nilai (0-100)">
            <input type="number" class="comp-weight w-1/4 px-3 py-2 border rounded bg-gray-50" placeholder="Bobot (%)">
        </div>
    `;
    editingGradeId = null;
    const saveBtn = document.querySelector('button[onclick="saveGrade()"]');
    saveBtn.innerText = "Simpan Nilai";
    saveBtn.className = "bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700";
}

function deleteGrade(docId) {
    if(confirm("Yakin ingin menghapus data nilai ini?")) {
        db.collection("grades").doc(docId).delete();
    }
}
// ==========================================
// PENCARIAN NILAI MAHASISWA
// ==========================================
function searchGrade() {
    const title = document.getElementById('searchTitle').value.trim().toLowerCase();
    const name = document.getElementById('searchName').value.trim().toLowerCase();
    const niu = document.getElementById('searchNiu').value.trim().toLowerCase();

    if(!title || !name || !niu) {
        alert("Mohon lengkapi ketiga data pencarian!"); 
        return;
    }

    const btn = document.querySelector('button[onclick="searchGrade()"]');
    btn.innerText = "Mencari...";

    // Menggunakan 1 filter utama (NIM) agar aman dari error index Firebase
    db.collection("grades")
      .where("studentNiu", "==", niu)
      .get()
      .then((querySnapshot) => {
          btn.innerText = "Cari Nilai Saya";
          
          if (querySnapshot.empty) {
              alert("Data tidak ditemukan. Pastikan NIM Anda sudah benar dan sudah diinput oleh pengajar.");
              document.getElementById('resultContainer').classList.add('hidden');
              return;
          }

          let foundData = null;
          
          // Cocokkan Judul dan Nama secara presisi dari data NIM yang ditemukan
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              if (data.practicumTitle === title && data.studentName === name) {
                  foundData = data;
              }
          });

          if (!foundData) {
              alert("Data ditemukan untuk NIM tersebut, tetapi Judul Praktikum atau Nama Lengkap tidak cocok. Pastikan ejaan dan spasi sama persis dengan yang diinput pengajar.");
              document.getElementById('resultContainer').classList.add('hidden');
              return;
          }

          // Tampilkan Hasil Nilai ke Layar
          document.getElementById('resultContainer').classList.remove('hidden');
          document.getElementById('resTitle').innerText = foundData.practicumTitle.toUpperCase();
          document.getElementById('resStudent').innerText = `${foundData.studentName.toUpperCase()} (${foundData.studentNiu.toUpperCase()})`;
          document.getElementById('resFinalScore').innerText = foundData.finalScore;

          // Tampilkan Rincian Komponen Nilai
          const compList = document.getElementById('resComponents');
          compList.innerHTML = '';
          foundData.components.forEach(c => {
              compList.innerHTML += `
              <li class="flex justify-between bg-gray-50 p-2 rounded border">
                  <span>${c.name} <span class="text-xs text-gray-500">(Bobot: ${c.weight}%)</span></span>
                  <span class="font-bold">${c.score}</span>
              </li>`;
          });
      })
      .catch((error) => {
          btn.innerText = "Cari Nilai Saya";
          console.error("Firebase Search Error:", error);
          alert("Gagal menghubungi server: " + error.message);
      });
}
