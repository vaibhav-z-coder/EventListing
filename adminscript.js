const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "secretPassword";
const LOGIN_KEY = "eventAdminLoggedIn_v1";
const API_BASE = "/api";

const placeholderImage = "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=900&q=80";

const demoEvents = [
  {
    title: "Frontend Bootcamp",
    description: "Hands-on frontend workshop covering UI, responsive layout and JavaScript rendering.",
    category: "Technology",
    date: "2026-08-20",
    time: "10:00",
    venue: "Community Hall",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    maxAttendees: 200
  },
  {
    title: "Music Night Live",
    description: "An evening event for live music, artists and college fest audience engagement.",
    category: "Music",
    date: "2026-08-25",
    time: "18:30",
    venue: "Open Arena",
    image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
    maxAttendees: 500
  },
  {
    title: "Startup Pitch Workshop",
    description: "Business workshop for founders, pitching practice and investor-style feedback.",
    category: "Business",
    date: "2026-09-02",
    time: "14:00",
    venue: "Innovation Lab",
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
    maxAttendees: 120
  }
];

let events = [];
let toastTimer;

const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");
const username = document.getElementById("username");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const editId = document.getElementById("editId");
const title = document.getElementById("title");
const description = document.getElementById("description");
const category = document.getElementById("category");
const date = document.getElementById("date");
const time = document.getElementById("time");
const venue = document.getElementById("venue");
const image = document.getElementById("image");
const maxAttendees = document.getElementById("maxAttendees");
const formError = document.getElementById("formError");
const formHeading = document.getElementById("formHeading");

const saveEventBtn = document.getElementById("saveEventBtn");
const clearEventBtn = document.getElementById("clearEventBtn");
const resetFormBtn = document.getElementById("resetFormBtn");
const seedBtn = document.getElementById("seedBtn");

const eventsList = document.getElementById("eventsList");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const dateFilter = document.getElementById("dateFilter");

const totalEvents = document.getElementById("totalEvents");
const totalAttendees = document.getElementById("totalAttendees");
const totalCategories = document.getElementById("totalCategories");
const upcomingEvents = document.getElementById("upcomingEvents");
const toast = document.getElementById("toast");

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, message: "Server returned an invalid response." };
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setBusy(button, isBusy, busyText) {
  if (!button) return;

  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

async function showDashboard() {
  loginScreen.classList.add("hidden");
  dashboard.classList.remove("hidden");
  await renderAll();
}

function showLogin() {
  dashboard.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

async function loginAdmin() {
  const enteredUsername = username.value.trim();
  const enteredPassword = password.value.trim();

  if (enteredUsername === ADMIN_USERNAME && enteredPassword === ADMIN_PASSWORD) {
    localStorage.setItem(LOGIN_KEY, "true");
    loginError.textContent = "";
    await showDashboard();
    showToast("Admin login successful");
  } else {
    loginError.textContent = "Invalid username or password";
  }
}

function logoutAdmin() {
  localStorage.removeItem(LOGIN_KEY);
  username.value = "";
  password.value = "";
  showLogin();
}

function validateForm() {
  if (!title.value.trim()) return "Event title cannot be empty";
  if (!description.value.trim()) return "Description is required";
  if (!category.value) return "Category is required";
  if (!date.value || Number.isNaN(new Date(`${date.value}T00:00:00`).getTime())) return "Date must be valid";
  if (!time.value) return "Time is required";
  if (!venue.value.trim()) return "Venue is required";
  if (!Number.isInteger(Number(maxAttendees.value)) || Number(maxAttendees.value) <= 0) {
    return "Maximum attendees must be a positive whole number";
  }
  return "";
}

function getFormData() {
  return {
    title: title.value.trim(),
    description: description.value.trim(),
    category: category.value,
    date: date.value,
    time: time.value,
    venue: venue.value.trim(),
    image: image.value.trim() || placeholderImage,
    maxAttendees: Number(maxAttendees.value)
  };
}

async function saveEvent() {
  const error = validateForm();
  if (error) {
    formError.textContent = error;
    return;
  }

  const isEditing = Boolean(editId.value);
  const endpoint = isEditing ? `/events/${encodeURIComponent(editId.value)}` : "/events";
  const method = isEditing ? "PUT" : "POST";

  setBusy(saveEventBtn, true, isEditing ? "Updating..." : "Saving...");
  formError.textContent = "";

  try {
    const response = await apiRequest(endpoint, {
      method,
      body: JSON.stringify(getFormData())
    });

    clearForm();
    await renderAll();
    showToast(response.message || (isEditing ? "Event updated successfully" : "Event created successfully"));
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    setBusy(saveEventBtn, false);
  }
}

function clearForm() {
  editId.value = "";
  title.value = "";
  description.value = "";
  category.value = "";
  date.value = "";
  time.value = "";
  venue.value = "";
  image.value = "";
  maxAttendees.value = "";
  formError.textContent = "";
  formHeading.textContent = "Create Event";
  saveEventBtn.textContent = "Save Event";
  saveEventBtn.disabled = false;
}

function editEvent(id) {
  const selectedEvent = events.find(event => String(event.id) === String(id));
  if (!selectedEvent) {
    showToast("Event not found");
    return;
  }

  editId.value = selectedEvent.id;
  title.value = selectedEvent.title;
  description.value = selectedEvent.description;
  category.value = selectedEvent.category;
  date.value = selectedEvent.date;
  time.value = selectedEvent.time;
  venue.value = selectedEvent.venue;
  image.value = selectedEvent.image || "";
  maxAttendees.value = selectedEvent.maxAttendees;
  formHeading.textContent = "Edit Event";
  saveEventBtn.textContent = "Update Event";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteEvent(id) {
  const selectedEvent = events.find(event => String(event.id) === String(id));
  if (!selectedEvent) return;

  const confirmDelete = confirm(`Delete “${selectedEvent.title}” permanently?`);
  if (!confirmDelete) return;

  try {
    const response = await apiRequest(`/events/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    if (String(editId.value) === String(id)) {
      clearForm();
    }

    await renderAll();
    showToast(response.message || "Event deleted successfully");
  } catch (error) {
    showToast(error.message);
  }
}

function renderCategoryFilter() {
  const currentValue = categoryFilter.value;
  const categories = [...new Set(events.map(event => event.category).filter(Boolean))].sort();

  categoryFilter.innerHTML = '<option value="All">All categories</option>';

  categories.forEach(categoryName => {
    const option = document.createElement("option");
    option.value = categoryName;
    option.textContent = categoryName;
    categoryFilter.appendChild(option);
  });

  categoryFilter.value = categories.includes(currentValue) ? currentValue : "All";
}

function getFilteredEvents() {
  const searchText = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedDate = dateFilter.value;

  return events.filter(event => {
    const searchableText = `${event.title} ${event.description} ${event.venue}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchText);
    const matchesCategory = selectedCategory === "All" || event.category === selectedCategory;
    const matchesDate = !selectedDate || event.date === selectedDate;
    return matchesSearch && matchesCategory && matchesDate;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderEvents() {
  const filteredEvents = getFilteredEvents();

  if (!filteredEvents.length) {
    eventsList.innerHTML = '<div class="empty-state">No events found</div>';
    return;
  }

  eventsList.innerHTML = filteredEvents.map(event => `
    <article class="event-card">
      <img
        src="${escapeHtml(event.image || placeholderImage)}"
        alt="${escapeHtml(event.title)}"
        onerror="this.onerror=null;this.src='${placeholderImage}'"
      />
      <div>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.description)}</p>
        <div class="event-meta">
          <span class="tag">${escapeHtml(event.category)}</span>
          <span class="tag">${escapeHtml(event.date)}</span>
          <span class="tag">${escapeHtml(event.time)}</span>
          <span class="tag">${escapeHtml(event.venue)}</span>
          <span class="tag">${Number(event.attendees || 0)}/${Number(event.maxAttendees || 0)} attendees</span>
        </div>
        <div class="card-actions">
          <button class="edit-btn" type="button" onclick="editEvent('${escapeHtml(event.id)}')">Edit</button>
          <button class="delete-btn" type="button" onclick="deleteEvent('${escapeHtml(event.id)}')">Delete</button>
        </div>
      </div>
    </article>
  `).join("");
}

async function loadEvents() {
  const response = await apiRequest("/events");
  events = Array.isArray(response.data) ? response.data : [];
  renderCategoryFilter();
  renderEvents();
}

async function loadDashboardStats() {
  const response = await apiRequest("/dashboard");
  const stats = response.data || {};

  totalEvents.textContent = Number(stats.totalEvents || 0);
  totalAttendees.textContent = Number(stats.totalAttendees || 0);
  totalCategories.textContent = Number(stats.totalCategories || 0);
  upcomingEvents.textContent = Number(stats.upcomingEvents || 0);
}

async function renderAll() {
  try {
    await Promise.all([loadEvents(), loadDashboardStats()]);
  } catch (error) {
    events = [];
    renderCategoryFilter();
    renderEvents();
    totalEvents.textContent = "—";
    totalAttendees.textContent = "—";
    totalCategories.textContent = "—";
    upcomingEvents.textContent = "—";
    showToast(error.message || "Unable to connect to the backend");
  }
}

async function loadDemoData() {
  const confirmed = confirm("Add three demo events to the database?");
  if (!confirmed) return;

  setBusy(seedBtn, true, "Loading...");

  try {
    for (const event of demoEvents) {
      await apiRequest("/events", {
        method: "POST",
        body: JSON.stringify(event)
      });
    }
    await renderAll();
    showToast("Demo events loaded into MySQL");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(seedBtn, false);
  }
}

loginBtn.addEventListener("click", loginAdmin);
password.addEventListener("keydown", event => {
  if (event.key === "Enter") loginAdmin();
});
username.addEventListener("keydown", event => {
  if (event.key === "Enter") loginAdmin();
});

logoutBtn.addEventListener("click", logoutAdmin);
saveEventBtn.addEventListener("click", saveEvent);
clearEventBtn.addEventListener("click", clearForm);
resetFormBtn.addEventListener("click", clearForm);
seedBtn.addEventListener("click", loadDemoData);
searchInput.addEventListener("input", renderEvents);
categoryFilter.addEventListener("change", renderEvents);
dateFilter.addEventListener("change", renderEvents);

window.addEventListener("focus", () => {
  if (localStorage.getItem(LOGIN_KEY) === "true") {
    renderAll();
  }
});

if (localStorage.getItem(LOGIN_KEY) === "true") {
  showDashboard();
} else {
  showLogin();
}
