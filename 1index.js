// const Kafka = require("kafka-node");

// const kafkaClient = new Kafka.KafkaClient({ kafkaHost: "localhost:9092" });
// const producer = new Kafka.Producer(kafkaClient);

// const generateRandomData = () => {
//   const heartRate = Math.floor(Math.random() * (120 - 60 + 1)) + 60; // Heart rate between 60-120 bpm
//   const batteryStatus = Math.max(0, Math.min(100, (Math.random() * 100).toFixed(1))); // Random battery percentage
//   const anomalies = {
//     arrhythmiaDetected: Math.random() < 0.05, // 5% chance of arrhythmia
//     highHeartRate: heartRate > 100, // Flag if heart rate exceeds 100 bpm
//     lowHeartRate: heartRate < 70 // Flag if heart rate drops below 70 bpm
//   };

//   return {
//     deviceId: `PACEMAKER-${Math.floor(Math.random() * 1000) + 1}`, // Random device ID
//     timestamp: new Date().toISOString(),
//     patientId: `PATIENT-${Math.floor(Math.random() * 1000) + 1}`, // Random patient ID
//     heartRate,
//     batteryStatus: Number(batteryStatus),
//     pacingMode: ["DDD", "AAI", "VVI"][Math.floor(Math.random() * 3)], // Random mode
//     pacingRate: Math.floor(Math.random() * (90 - 60 + 1)) + 60, // Pacing rate between 60-90 bpm
//     anomalies,
//     geoLocation: {
//       latitude: (Math.random() * 180 - 90).toFixed(6), // Random latitude
//       longitude: (Math.random() * 360 - 180).toFixed(6) // Random longitude
//     }
//   };
// };

// const publishDynamicData = () => {
//   const pacemakerData = generateRandomData();
//   const payload = [
//     { topic: "pacemaker-data", messages: JSON.stringify(pacemakerData), partition: 0 }
//   ];

//   producer.send(payload, (err, data) => {
//     if (err) console.error("Error publishing to Kafka:", err);
//     else console.log("Published:", pacemakerData);
//   });
// };

// // Publish data at regular intervals
// producer.on("ready", () => {
//   console.log("Kafka Producer is connected and ready.");
//   setInterval(publishDynamicData, 2000); // Publish every 2 seconds
// });

// producer.on("error", (err) => {
//   console.error("Kafka Producer error:", err);
// });

const Kafka = require("kafka-node");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Kafka configuration
const kafkaClient = new Kafka.KafkaClient({ kafkaHost: "localhost:9092" });
const producer = new Kafka.Producer(kafkaClient);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Replace with your frontend's URL
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"], // Allow custom headers
  },
});

const corsOptions = {
  origin: "http://localhost:5173", // Replace with your frontend's URL
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true, // if you need to send cookies across domains
};

app.use(cors(corsOptions));

let isPublishing = false;
let publishInterval = null;
let pacemakerData;

// Generate random pacemaker data
// const generateRandomData = () => ({
//   deviceId: `PACEMAKER-${Math.floor(Math.random() * 1000) + 1}`,
//   timestamp: new Date().toISOString(),
//   heartRate: Math.floor(Math.random() * (120 - 60 + 1)) + 60,
//   batteryStatus: Math.max(0, Math.min(100, (Math.random() * 100).toFixed(1))),
//   pacingMode: ["DDD", "AAI", "VVI"][Math.floor(Math.random() * 3)],
//   pacingRate: Math.floor(Math.random() * (90 - 60 + 1)) + 60,
//   anomalies: {
//     arrhythmiaDetected: Math.random() < 0.05,
//     highHeartRate: false,
//     lowHeartRate: false,
//   },
//   geoLocation: {
//     latitude: (Math.random() * 180 - 90).toFixed(6),
//     longitude: (Math.random() * 360 - 180).toFixed(6),
//   },
// });

let loopCount = 0; // Initialize a counter

// Generate random pacemaker data
const generateRandomData = () => {
  loopCount++; // Increment the counter on every call

  const heartRate = Math.floor(Math.random() * (120 - 60 + 1)) + 60;

  return {
    deviceId: `PACEMAKER-${Math.floor(Math.random() * 1000) + 1}`,
    timestamp: new Date().toISOString(),
    heartRate,
    batteryStatus: Math.max(0, Math.min(100, (Math.random() * 100).toFixed(1))),
    pacingMode: ["DDD", "AAI", "VVI"][Math.floor(Math.random() * 3)],
    pacingRate: Math.floor(Math.random() * (90 - 60 + 1)) + 60,
    anomalies: {
      arrhythmiaDetected: Math.random() < 0.05,
      highHeartRate: loopCount % 20 === 0, // Trigger on every 20th loop
      lowHeartRate: heartRate < 70,
    },
    geoLocation: {
      latitude: (Math.random() * 180 - 90).toFixed(6),
      longitude: (Math.random() * 360 - 180).toFixed(6),
    },
  };
};

// Start publishing data
const startPublishing = (socket) => {
  if (isPublishing) return;
  isPublishing = true;
  console.log("Kafka producer started");

  publishInterval = setInterval(() => {
    pacemakerData = generateRandomData();

    const payload = [
      {
        topic: "pacemaker-data",
        messages: JSON.stringify(pacemakerData),
        partition: 0,
      },
    ];
    io.emit("pacemakerData", pacemakerData);

    producer.send(payload, (err) => {
      if (err) console.error("Error publishing to Kafka:", err);
      else console.log("Published:", pacemakerData);
    });
  }, 2000);
};

// Stop publishing data
const stopPublishing = () => {
  if (!isPublishing) return;
  isPublishing = false;
  clearInterval(publishInterval);
  console.log("Kafka producer stopped");
};

// Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("start", () => {
    startPublishing();
  });

  socket.on("stop", () => {
    stopPublishing();
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    stopPublishing();
  });

  // setInterval(() => {
  //   socket.emit(pacemakerData);
  // }, 1000);
});

// Start the server
producer.on("ready", () => {
  console.log("Kafka Producer is connected and ready.");
  server.listen(8080, () =>
    console.log("Server is running on http://localhost:8080")
  );
});

producer.on("error", (err) => {
  console.error("Kafka Producer error:", err);
});
