

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "testdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
});

function mapEventRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    category: row.category,
    date: row.event_date instanceof Date
      ? row.event_date.toISOString().split("T")[0]
      : String(row.event_date),
    time: row.event_time ? String(row.event_time).slice(0, 5) : "",
    venue: row.venue,
    location: row.venue,
    image: row.image_url || "",
    imageUrl: row.image_url || "",
    maxAttendees: Number(row.max_attendees || 0),
    attendees: Number(row.attendees || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateEventPayload(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const category = String(body.category || "").trim();
  const eventDate = String(body.date || body.event_date || "").trim();
  const eventTime = String(body.time || body.event_time || "").trim();
  const venue = String(body.venue || body.location || "").trim();
  const imageUrl = String(body.image || body.imageUrl || body.image_url || "").trim();
  const maxAttendees = Number(body.maxAttendees ?? body.max_attendees);

  if (!title) return { error: "Event title is required." };
  if (!description) return { error: "Description is required." };
  if (!category) return { error: "Category is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { error: "A valid event date is required." };
  if (!/^\d{2}:\d{2}/.test(eventTime)) return { error: "A valid event time is required." };
  if (!venue) return { error: "Venue is required." };
  if (!Number.isInteger(maxAttendees) || maxAttendees <= 0) {
    return { error: "Maximum attendees must be a positive integer." };
  }

  return {
    value: {
      title,
      description,
      category,
      eventDate,
      eventTime,
      venue,
      imageUrl,
      maxAttendees
    }
  };
}

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT DATABASE() AS database_name, NOW() AS server_time");
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Database connection failed.", error: error.message });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, description, category, event_date, event_time,
             venue, image_url, max_attendees, attendees, created_at, updated_at
      FROM events
      ORDER BY event_date ASC, event_time ASC
    `);

    res.json({ success: true, data: rows.map(mapEventRow) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to fetch events.", error: error.message });
  }
});

app.get("/api/events/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT id, title, description, category, event_date, event_time,
             venue, image_url, max_attendees, attendees, created_at, updated_at
      FROM events
      WHERE id = ?
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    res.json({ success: true, data: mapEventRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to fetch the event.", error: error.message });
  }
});

app.post("/api/events", async (req, res) => {
  const validation = validateEventPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  const event = validation.value;

  try {
    const [result] = await pool.execute(`
      INSERT INTO events (
        title, description, category, event_date, event_time,
        venue, image_url, max_attendees, attendees
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      event.title,
      event.description,
      event.category,
      event.eventDate,
      event.eventTime,
      event.venue,
      event.imageUrl || null,
      event.maxAttendees
    ]);

    const [rows] = await pool.execute("SELECT * FROM events WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, message: "Event created successfully.", data: mapEventRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to create event.", error: error.message });
  }
});

app.put("/api/events/:id", async (req, res) => {
  const validation = validateEventPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  const event = validation.value;

  try {
    const [currentRows] = await pool.execute(
      "SELECT attendees FROM events WHERE id = ?",
      [req.params.id]
    );

    if (!currentRows.length) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    if (Number(currentRows[0].attendees) > event.maxAttendees) {
      return res.status(400).json({
        success: false,
        message: "Maximum attendees cannot be lower than the current attendee count."
      });
    }

    await pool.execute(`
      UPDATE events
      SET title = ?, description = ?, category = ?, event_date = ?,
          event_time = ?, venue = ?, image_url = ?, max_attendees = ?
      WHERE id = ?
    `, [
      event.title,
      event.description,
      event.category,
      event.eventDate,
      event.eventTime,
      event.venue,
      event.imageUrl || null,
      event.maxAttendees,
      req.params.id
    ]);

    const [rows] = await pool.execute("SELECT * FROM events WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Event updated successfully.", data: mapEventRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to update event.", error: error.message });
  }
});

app.delete("/api/events/:id", async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM events WHERE id = ?", [req.params.id]);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    res.json({ success: true, message: "Event deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to delete event.", error: error.message });
  }
});

app.post("/api/events/:id/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const ticketQty = Number(req.body.ticketQty || 1);

  if (!name) {
    return res.status(400).json({ success: false, message: "Name is required." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "A valid email address is required." });
  }

  if (!Number.isInteger(ticketQty) || ticketQty <= 0) {
    return res.status(400).json({ success: false, message: "Ticket quantity must be a positive integer." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [eventRows] = await connection.execute(
      "SELECT id, attendees, max_attendees FROM events WHERE id = ? FOR UPDATE",
      [req.params.id]
    );

    if (!eventRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const event = eventRows[0];
    const seatsRemaining = Number(event.max_attendees) - Number(event.attendees);

    if (ticketQty > seatsRemaining) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Registration failed. Only ${Math.max(seatsRemaining, 0)} seat(s) remaining.`
      });
    }

    await connection.execute(`
      INSERT INTO users (name, email)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, [name, email]);

    const [userRows] = await connection.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    const userId = userRows[0].id;

    await connection.execute(`
      INSERT INTO registrations (user_id, event_id, ticket_qty)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ticket_qty = ticket_qty + VALUES(ticket_qty),
        updated_at = CURRENT_TIMESTAMP
    `, [userId, req.params.id, ticketQty]);

    await connection.execute(
      "UPDATE events SET attendees = attendees + ? WHERE id = ?",
      [ticketQty, req.params.id]
    );

    const [updatedEventRows] = await connection.execute(
      "SELECT * FROM events WHERE id = ?",
      [req.params.id]
    );

    const [registrationRows] = await connection.execute(`
      SELECT r.id, r.user_id, r.event_id, r.ticket_qty,
             r.registered_at, r.updated_at, u.name, u.email
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ? AND r.event_id = ?
    `, [userId, req.params.id]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Successfully registered for the event.",
      data: {
        event: mapEventRow(updatedEventRows[0]),
        registration: registrationRows[0]
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "Registration failed.", error: error.message });
  } finally {
    connection.release();
  }
});

app.delete("/api/events/:id/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const ticketQty = Number(req.body.ticketQty || 1);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "A valid email address is required." });
  }

  if (!Number.isInteger(ticketQty) || ticketQty <= 0) {
    return res.status(400).json({ success: false, message: "Ticket quantity must be a positive integer." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(`
      SELECT r.id, r.ticket_qty, r.user_id
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      WHERE u.email = ? AND r.event_id = ?
      FOR UPDATE
    `, [email, req.params.id]);

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "No active registration found." });
    }

    const registration = rows[0];

    if (Number(registration.ticket_qty) < ticketQty) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `You only have ${registration.ticket_qty} ticket(s) for this event.`
      });
    }

    const remainingTickets = Number(registration.ticket_qty) - ticketQty;

    if (remainingTickets === 0) {
      await connection.execute("DELETE FROM registrations WHERE id = ?", [registration.id]);
    } else {
      await connection.execute(
        "UPDATE registrations SET ticket_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [remainingTickets, registration.id]
      );
    }

    await connection.execute(
      "UPDATE events SET attendees = GREATEST(attendees - ?, 0) WHERE id = ?",
      [ticketQty, req.params.id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Registration cancelled successfully.",
      data: { remainingTickets }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "Unable to cancel registration.", error: error.message });
  } finally {
    connection.release();
  }
});

app.get("/api/registrations", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.ticket_qty, r.registered_at, r.updated_at,
             u.id AS user_id, u.name, u.email,
             e.id AS event_id, e.title AS event_title
      FROM registrations r
      JOIN users u ON u.id = r.user_id
      JOIN events e ON e.id = r.event_id
      ORDER BY r.registered_at DESC
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to fetch registrations.", error: error.message });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total_events,
        COALESCE(SUM(attendees), 0) AS total_attendees,
        COUNT(DISTINCT category) AS total_categories,
        COALESCE(SUM(event_date >= CURDATE()), 0) AS upcoming_events
      FROM events
    `);

    res.json({
      success: true,
      data: {
        totalEvents: Number(rows[0].total_events || 0),
        totalAttendees: Number(rows[0].total_attendees || 0),
        totalCategories: Number(rows[0].total_categories || 0),
        upcomingEvents: Number(rows[0].upcoming_events || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to fetch dashboard statistics.", error: error.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/user", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Internal server error." });
});

async function startServer() {
  try {
    const connection = await pool.getConnection();
    console.log("MySQL connected successfully.");
    connection.release();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`User panel: http://localhost:${PORT}/`);
      console.log(`Admin panel: http://localhost:${PORT}/admin`);
    });
  } catch (error) {
    console.error("Unable to connect to MySQL:", error.message);
    process.exit(1);
  }
}

startServer();