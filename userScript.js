const API_BASE = "/api";
    const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80";

    const state = {
      events: [],
      selectedEventId: null,
      filters: {
        search: "",
        category: "all",
        date: ""
      }
    };

    const elements = {
      eventsGrid: document.getElementById("eventsGrid"),
      heroEventCount: document.getElementById("heroEventCount"),
      resultSummary: document.getElementById("resultSummary"),
      searchInput: document.getElementById("searchInput"),
      categoryFilter: document.getElementById("categoryFilter"),
      dateFilter: document.getElementById("dateFilter"),
      clearFilters: document.getElementById("clearFilters"),
      browseButton: document.getElementById("browseButton"),
      detailsModal: document.getElementById("detailsModal"),
      closeModal: document.getElementById("closeModal"),
      modalImage: document.getElementById("modalImage"),
      modalCategory: document.getElementById("modalCategory"),
      modalTitle: document.getElementById("modalTitle"),
      modalMeta: document.getElementById("modalMeta"),
      modalDescription: document.getElementById("modalDescription"),
      registrationForm: document.getElementById("registrationForm"),
      modalRegisterButton: document.getElementById("modalRegisterButton"),
      chatToggle: document.getElementById("chatToggle"),
      chatPanel: document.getElementById("chatPanel"),
      chatMessages: document.getElementById("chatMessages"),
      chatForm: document.getElementById("chatForm"),
      chatInput: document.getElementById("chatInput"),
      toast: document.getElementById("toast")
    };

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

    function normalizeEvent(event) {
      return {
        ...event,
        id: String(event.id),
        title: String(event.title || "Untitled event"),
        description: String(event.description || "Details will be announced soon."),
        category: String(event.category || "General"),
        date: String(event.date || ""),
        time: String(event.time || ""),
        location: String(event.location || event.venue || "Venue to be announced"),
        image: String(event.image || event.imageUrl || FALLBACK_IMAGE),
        attendees: Number(event.attendees || 0),
        maxAttendees: Number(event.maxAttendees || 0)
      };
    }

    async function loadEvents() {
      try {
        const response = await apiRequest("/events");
        state.events = Array.isArray(response.data)
          ? response.data.map(normalizeEvent)
          : [];
        populateCategories();
        renderEvents();
      } catch (error) {
        state.events = [];
        populateCategories();
        renderEvents();
        showToast(error.message || "Unable to load events.");
      }
    }

    function populateCategories() {
      const currentValue = elements.categoryFilter.value;
      const categories = [...new Set(state.events.map((event) => event.category).filter(Boolean))].sort();

      elements.categoryFilter.innerHTML = '<option value="all">All categories</option>' +
        categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");

      elements.categoryFilter.value = categories.includes(currentValue) ? currentValue : "all";
    }

    function getFilteredEvents() {
      const query = state.filters.search.trim().toLowerCase();

      return state.events
        .filter((event) => {
          const matchesSearch = !query || [event.title, event.location, event.description]
            .some((value) => value.toLowerCase().includes(query));
          const matchesCategory = state.filters.category === "all" || event.category === state.filters.category;
          const matchesDate = !state.filters.date || event.date === state.filters.date;
          return matchesSearch && matchesCategory && matchesDate;
        })
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }

    function renderEvents() {
      const filteredEvents = getFilteredEvents();
      elements.heroEventCount.textContent = state.events.length;
      elements.resultSummary.textContent = `${filteredEvents.length} of ${state.events.length} event${state.events.length === 1 ? "" : "s"} shown`;

      if (!filteredEvents.length) {
        elements.eventsGrid.innerHTML = `
          <div class="empty-state">
            <h3>No events found</h3>
            <p>${state.events.length ? "Try changing the search, category or date filter." : "No event has been published by the administrator yet."}</p>
          </div>
        `;
        return;
      }

      elements.eventsGrid.innerHTML = filteredEvents.map((event) => {
        const isFull = event.maxAttendees > 0 && event.attendees >= event.maxAttendees;
        const capacityText = event.maxAttendees > 0
          ? `${event.attendees} / ${event.maxAttendees} attending`
          : `${event.attendees} attending`;

        return `
          <article class="event-card">
            <div class="event-image-wrap">
              <img
                class="event-image"
                src="${escapeAttribute(event.image)}"
                alt="${escapeAttribute(event.title)}"
                onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
              />
              <span class="category-badge">${escapeHtml(event.category)}</span>
            </div>
            <div class="event-body">
              <span class="event-date">${formatDate(event.date)}${event.time ? ` · ${escapeHtml(formatTime(event.time))}` : ""}</span>
              <h3 class="event-title">${escapeHtml(event.title)}</h3>
              <p class="event-description">${escapeHtml(event.description)}</p>
              <div class="event-meta">
                <span class="meta-line">⌖ ${escapeHtml(event.location)}</span>
                <span class="meta-line">◉ ${capacityText}</span>
              </div>
              <div class="event-actions">
                <button class="card-btn" type="button" data-action="details" data-id="${escapeAttribute(event.id)}">View details</button>
                <button class="card-btn register" type="button" data-action="register" data-id="${escapeAttribute(event.id)}" ${isFull ? "disabled" : ""}>
                  ${isFull ? "Event full" : "Register"}
                </button>
              </div>
            </div>
          </article>
        `;
      }).join("");
    }

    function openEventModal(eventId, focusRegistration = false) {
      const event = state.events.find((item) => item.id === String(eventId));
      if (!event) return;

      state.selectedEventId = event.id;
      const isFull = event.maxAttendees > 0 && event.attendees >= event.maxAttendees;

      elements.modalImage.src = event.image || FALLBACK_IMAGE;
      elements.modalImage.alt = event.title;
      elements.modalImage.onerror = () => {
        elements.modalImage.onerror = null;
        elements.modalImage.src = FALLBACK_IMAGE;
      };
      elements.modalCategory.textContent = event.category;
      elements.modalTitle.textContent = event.title;
      elements.modalDescription.textContent = event.description;
      elements.modalMeta.innerHTML = `
        <span class="meta-line">◷ ${formatDate(event.date)}${event.time ? ` at ${escapeHtml(formatTime(event.time))}` : ""}</span>
        <span class="meta-line">⌖ ${escapeHtml(event.location)}</span>
        <span class="meta-line">◉ ${event.attendees}${event.maxAttendees > 0 ? ` / ${event.maxAttendees}` : ""} attending</span>
      `;
      elements.modalRegisterButton.disabled = isFull;
      elements.modalRegisterButton.textContent = isFull ? "Event is full" : "Confirm registration";
      elements.registrationForm.reset();
      elements.detailsModal.classList.add("open");
      document.body.style.overflow = "hidden";

      if (focusRegistration && !isFull) {
        setTimeout(() => document.getElementById("registrantName").focus(), 80);
      }
    }

    function closeEventModal() {
      elements.detailsModal.classList.remove("open");
      document.body.style.overflow = "";
      state.selectedEventId = null;
    }

    async function registerForSelectedEvent(event) {
      event.preventDefault();

      const formData = new FormData(elements.registrationForm);
      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!name || !validEmail) {
        showToast("Enter a valid name and email address.");
        return;
      }

      if (!state.selectedEventId) {
        showToast("No event selected.");
        return;
      }

      elements.modalRegisterButton.disabled = true;
      elements.modalRegisterButton.textContent = "Registering...";

      try {
        const response = await apiRequest(`/events/${encodeURIComponent(state.selectedEventId)}/register`, {
          method: "POST",
          body: JSON.stringify({
            name,
            email,
            ticketQty: 1
          })
        });

        closeEventModal();
        await loadEvents();
        showToast(response.message || "Registration confirmed successfully.");
      } catch (error) {
        showToast(error.message);
        elements.modalRegisterButton.disabled = false;
        elements.modalRegisterButton.textContent = "Confirm registration";
      }
    }

    function formatDate(dateValue) {
      if (!dateValue) return "Date to be announced";
      const parsed = new Date(`${dateValue}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return escapeHtml(dateValue);
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(parsed);
    }

    function formatTime(timeValue) {
      if (!timeValue) return "";
      const [hours, minutes] = String(timeValue).split(":");
      const parsed = new Date();
      parsed.setHours(Number(hours), Number(minutes || 0), 0, 0);
      if (Number.isNaN(parsed.getTime())) return timeValue;
      return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit"
      }).format(parsed);
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function escapeAttribute(value) {
      return escapeHtml(value);
    }

    let toastTimer;
    function showToast(message) {
      clearTimeout(toastTimer);
      elements.toast.textContent = message;
      elements.toast.classList.add("show");
      toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
    }

    function appendMessage(text, sender) {
      const message = document.createElement("div");
      message.className = `message ${sender}`;
      const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date());
      message.innerHTML = `${escapeHtml(text)}<span class="message-time">${time}</span>`;
      elements.chatMessages.appendChild(message);
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    function getChatResponse(input) {
      const query = input.trim().toLowerCase();

      if (!query) {
        return "Please enter an event-related question.";
      }

      const greetings = ["hi", "hello", "hey", "hii", "hola", "namaste", "good morning", "good afternoon", "good evening"];
      const thanksWords = ["thanks", "thank you", "thankyou", "thx"];
      const goodbyeWords = ["bye", "goodbye", "see you", "see ya"];

      if (greetings.some((greeting) => query === greeting || query.startsWith(`${greeting} `))) {
        return "Hello! I can help you with the events currently listed on this platform. Ask me using an event name, category, date, venue, or registration question.";
      }

      if (query.includes("how are you")) {
        return "I am ready to help you discover listed events. Ask me about any event by name.";
      }

      if (thanksWords.some((word) => query === word || query.includes(word))) {
        return "You are welcome. Ask me anytime about the listed events.";
      }

      if (goodbyeWords.some((word) => query === word || query.includes(word))) {
        return "Goodbye. Check back anytime for event details and registration information.";
      }

      if (!state.events.length) {
        return "No events have been published yet.";
      }

      const directEventMatch = state.events.find((event) => {
        const eventTitle = event.title.toLowerCase().trim();
        return query.includes(eventTitle) || eventTitle.includes(query);
      });

      if (directEventMatch) {
        const capacity = directEventMatch.maxAttendees > 0
          ? `${directEventMatch.attendees} out of ${directEventMatch.maxAttendees} attendees registered`
          : `${directEventMatch.attendees} attendees registered`;

        return `${directEventMatch.title}: ${directEventMatch.description} Category: ${directEventMatch.category}. Date: ${formatDate(directEventMatch.date)}${directEventMatch.time ? ` at ${formatTime(directEventMatch.time)}` : ""}. Venue: ${directEventMatch.location}. Registration status: ${capacity}.`;
      }

      const eventKeywords = [
        "event", "events", "upcoming", "category", "categories", "technology", "tech",
        "music", "workshop", "business", "design", "register", "registration",
        "booking", "date", "venue", "location", "attendee", "attendees"
      ];

      const isEventRelated = eventKeywords.some((keyword) => query.includes(keyword));

      if (!isEventRelated) {
        return "Not enough data to answer the given Question";
      }

      if (query.includes("register") || query.includes("registration") || query.includes("booking")) {
        return "Select any listed event, click Register, enter your full name and email address, then confirm registration.";
      }

      if (query.includes("category") || query.includes("categories")) {
        const categories = [...new Set(state.events.map((event) => event.category))];
        return `Available event categories are: ${categories.join(", ")}.`;
      }

      const categoryAliases = {
        tech: "technology",
        technology: "technology",
        music: "music",
        workshop: "workshop",
        business: "business",
        design: "design"
      };

      const requestedCategory = Object.keys(categoryAliases).find((key) => query.includes(key));

      if (requestedCategory) {
        const categoryName = categoryAliases[requestedCategory];
        const matches = state.events.filter((event) =>
          event.category.toLowerCase().includes(categoryName) ||
          event.title.toLowerCase().includes(categoryName) ||
          event.description.toLowerCase().includes(categoryName)
        );

        if (!matches.length) {
          return `No ${categoryName} events are currently listed.`;
        }

        return `${matches.length} matching event${matches.length === 1 ? " is" : "s are"} listed: ${matches
          .map((event) => `${event.title} on ${formatDate(event.date)} at ${event.location}`)
          .join("; ")}.`;
      }

      if (query.includes("upcoming") || query.includes("events") || query.includes("event")) {
        const upcomingEvents = [...state.events]
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));

        return `Currently listed events are: ${upcomingEvents
          .map((event) => `${event.title} on ${formatDate(event.date)} at ${event.location}`)
          .join("; ")}. Ask using an exact event name to get complete details.`;
      }

      return "Not enough data to answer the given Question";
    }

    elements.eventsGrid.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-id]");
      if (!button) return;
      openEventModal(button.dataset.id, button.dataset.action === "register");
    });

    elements.searchInput.addEventListener("input", (event) => {
      state.filters.search = event.target.value;
      renderEvents();
    });

    elements.categoryFilter.addEventListener("change", (event) => {
      state.filters.category = event.target.value;
      renderEvents();
    });

    elements.dateFilter.addEventListener("change", (event) => {
      state.filters.date = event.target.value;
      renderEvents();
    });

    elements.clearFilters.addEventListener("click", () => {
      state.filters = { search: "", category: "all", date: "" };
      elements.searchInput.value = "";
      elements.categoryFilter.value = "all";
      elements.dateFilter.value = "";
      renderEvents();
    });

    elements.browseButton.addEventListener("click", () => {
      document.getElementById("events").scrollIntoView({ behavior: "smooth" });
    });

    elements.closeModal.addEventListener("click", closeEventModal);
    elements.detailsModal.addEventListener("click", (event) => {
      if (event.target === elements.detailsModal) closeEventModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeEventModal();
        elements.chatPanel.classList.remove("open");
        elements.chatToggle.setAttribute("aria-expanded", "false");
      }
    });

    elements.registrationForm.addEventListener("submit", registerForSelectedEvent);

    elements.chatToggle.addEventListener("click", () => {
      const isOpen = elements.chatPanel.classList.toggle("open");
      elements.chatToggle.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) elements.chatInput.focus();
    });

    elements.chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = elements.chatInput.value.trim();
      if (!message) return;
      appendMessage(message, "user");
      elements.chatInput.value = "";
      setTimeout(() => appendMessage(getChatResponse(message), "bot"), 350);
    });

    window.addEventListener("focus", loadEvents);

    appendMessage("Hello! Ask me using any listed event name, or say hi to get started.", "bot");
    loadEvents();