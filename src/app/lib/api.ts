import { projectId, publicAnonKey } from '/utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e27a5f03`;

const headers = () => ({
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
});

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: options?.headers || headers(),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`API Error [${path}]:`, data);
    throw new Error(data.error || 'API error');
  }
  return data;
}

// Auth
export async function login(name: string, password: string, role: 'intern' | 'mentor') {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password, role }),
  });
}

// Interns list (mentor)
export async function getInterns() {
  return request('/interns');
}

// Attendance
export async function clockIn(name: string, lat: string, lng: string, address: string, photo: Blob | null) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('lat', lat);
  formData.append('lng', lng);
  formData.append('address', address);
  if (photo) formData.append('photo', photo, 'clockin.jpg');

  return fetch(`${BASE_URL}/attendance/clockin`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    body: formData,
  }).then(r => r.json());
}

export async function clockOut(name: string, lat: string, lng: string, address: string, report: string, photo: Blob | null) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('lat', lat);
  formData.append('lng', lng);
  formData.append('address', address);
  formData.append('report', report);
  if (photo) formData.append('photo', photo, 'clockout.jpg');

  return fetch(`${BASE_URL}/attendance/clockout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    body: formData,
  }).then(r => r.json());
}

// Mid-Day Check In
export async function midDayCheckIn(name: string, lat: string, lng: string, address: string, activity: string, photo: Blob | null) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('lat', lat);
  formData.append('lng', lng);
  formData.append('address', address);
  formData.append('activity', activity); // Menyisipkan data kegiatan
  if (photo) formData.append('photo', photo, 'midday.jpg');

  return fetch(`${BASE_URL}/attendance/midday`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    body: formData,
  }).then(r => r.json());
}

export async function getAttendance(name: string) {
  return request(`/attendance/${encodeURIComponent(name.toLowerCase().trim())}`);
}

export async function approveAttendance(internName: string, date: string, mentorName: string) {
  return request('/attendance/approve', {
    method: 'POST',
    body: JSON.stringify({ internName, date, mentorName }),
  });
}

// Quiz
export async function getQuizQuestions() {
  return request('/quiz/questions');
}

export async function updateQuizQuestions(questions: any[]) {
  return request('/quiz/questions', {
    method: 'PUT',
    body: JSON.stringify({ questions }),
  });
}

export async function submitQuizResult(name: string, score: number, totalQuestions: number, answers: any[]) {
  return request('/quiz/submit', {
    method: 'POST',
    body: JSON.stringify({ name, score, totalQuestions, answers }),
  });
}

export async function getQuizResults(name: string) {
  return request(`/quiz/results/${encodeURIComponent(name.toLowerCase().trim())}`);
}

// Materials
export async function getMaterials() {
  return request('/materials');
}

export async function uploadMaterial(title: string, file: File) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', file);

  return fetch(`${BASE_URL}/materials/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    body: formData,
  }).then(r => r.json());
}

export async function deleteMaterial(id: number) {
  return request(`/materials/${id}`, { method: 'DELETE' });
}

// GPS helper
export async function getAccurateLocation(): Promise<{ lat: number; lng: number; address: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 0, lng: 0, address: 'Geolocation tidak tersedia' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=id`);
          const data = await res.json();
          if (data.display_name) address = data.display_name;
        } catch {}
        resolve({ lat: latitude, lng: longitude, address });
      },
      () => resolve({ lat: 0, lng: 0, address: 'Lokasi tidak tersedia' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}