const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const fs = require("fs");
const stream = require('stream');
const path = require("path");
const cors = require("cors");
const sharp = require('sharp');
const DB_URL = process.env.DB_URI
require('dotenv').config


const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: "*" }));

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://caebptbapatla:Caebptbapatla_123@caebptcluster.yla6js4.mongodb.net/caebpt",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
const db = mongoose.connection;

// Check MongoDB connection
db.on("error", (err) => console.error("MongoDB connection error:", err));
db.once("open", () => console.log("Connected to MongoDB"));

// Define image storage and file filter
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// File filter to accept only certain image formats
const allowedFormats = [".jpg", ".jpeg", ".png", ".pdf"];

const imageFilter = function (req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedFormats.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only jpg, jpeg, png, and pdf files are allowed."));
  }
};

// Multer middleware for file upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 5MB limit for each image
  fileFilter: imageFilter,
});



const processFile = (file) => {
  return new Promise(async (resolve, reject) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.pdf') {
      // Handle PDF files
      const pdfData = fs.readFileSync(file.path);
      const base64PDF = pdfData.toString('base64');
      resolve(base64PDF);
    } else if (allowedFormats.includes(ext)) {
      // Handle image files
      const readStream = fs.createReadStream(file.path);
      const writeStream = new stream.PassThrough();

      readStream.on('error', (err) => {
        reject(err);
      });

      readStream.pipe(writeStream);

      const image = await sharp(file.path).resize(900, 900, { fit: 'inside' }).toBuffer();
      const base64Image = Buffer.from(image).toString('base64');
      resolve(base64Image);
    } else {
      // Invalid format
      reject(new Error("Only jpg, jpeg, png, and pdf files are allowed."));
    }
  });
};



// CAROUSEL API (GET, POST, DELETE)
// ******************************************************************

const carouselSchema = new mongoose.Schema({
  Description: { type: String, required: false },
  Title: { type: String, required: false },

  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },
  Link: String,
  IsNew: Boolean,
  Image: String,
});

// Define a Mongoose model based on the data schema

const carouselData = mongoose.model("Carousels", carouselSchema);

// Route to handle data upload
app.post("/carousel", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    // Read the image file and convert it to base64 string
    const imageFile = fs.readFileSync(req.file.path);
    const base64Image = imageFile.toString("base64");

    // Create a new Data document and save it to the database
    const newData = new carouselData({
      Description: req.body.description,
      Title: req.body.title,
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Link: req.body.link,
      IsNew: req.body.isNew,
      Image: base64Image, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/carousel", async (req, res) => {
  try {
    const allData = await carouselData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/carousel/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await carouselData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

// NOTICEBOARD API()
// *****************************************************************

const noticboardSchema = new mongoose.Schema({
  Description: { type: String, required: false },
  OneLiner: String,
  Title: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },
  Link: String,
  IsNew: Boolean,
  Image: [String],
});

const NoticeboardData = mongoose.model("Noticeboards", noticboardSchema);

// Route to handle data upload for the Noticeboard
app.post('/noticeboard', upload.array('images', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one image or PDF." });
    }

    // Process each uploaded file using streams
    const filePromises = req.files.map(processFile);

    // Wait for all the file conversions to complete
    const base64Files = await Promise.all(filePromises);

    // Create a new Data document and save it to the database
    const newData = new NoticeboardData({
      Description: req.body.descriptions,
      OneLiner: req.body.oneLiners,
      Title: req.body.titles,
      StartDate: req.body.startDates,
      EndDate: req.body.endDates,
      Link: req.body.links,
      IsNew: req.body.isNews,
      Image: base64Files, // Store the array of base64 strings in the Image field
    });

    await newData.save();

    // Remove the uploaded files after saving the data to the database
    req.files.forEach((file) => {
      fs.unlinkSync(file.path);
    });

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error." });
  }
});




app.get("/noticeboard", async (req, res) => {
  try {
    const allData = await NoticeboardData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/noticeboard/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await NoticeboardData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});


app.get("/noticeboard/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    // Assuming NoticeboardData is your data model or collection.
    const noticeData = await NoticeboardData.findById(dataId);
    if (!noticeData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json(noticeData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});


// STAFF API()
// *****************************************************************

const staffSchema = new mongoose.Schema({
  Description: { type: String, required: false },
  Designation: { type: String, required: false },
  Name: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },
  DOB: {
    type: Date,
    required: false,
  },
  Mailid: {
    type: String,
    required: false,
  },
  Contactnumber: {
    type: String,
    required: false,
  },
  Image: String,
});

const staffData = mongoose.model("Staffs", staffSchema);

// Route to handle data upload for the Noticeboard
app.post("/staff", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    // Read the image file and convert it to base64 string
    const imageFile = fs.readFileSync(req.file.path);
    const base64Image = imageFile.toString("base64");

    // Create a new Data document and save it to the database
    const newData = new staffData({
      Description: req.body.description,
      Designation: req.body.designation,
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Name: req.body.name,
      DOB: req.body.dob,
      Mailid: req.body.mailid,
      Contactnumber: req.body.contactnumber,
      Image: base64Image, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/staff", async (req, res) => {
  try {
    const allData = await staffData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/staff/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await staffData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

// HIRING PARTNERS API()
// *****************************************************************

const hpSchema = new mongoose.Schema({
  Title: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },
  Hiredcount: { type: String, required: false },
  Image: String,
});

const hpData = mongoose.model("Hiringpartners", hpSchema);

// Route to handle data upload for the Noticeboard
app.post("/hiringpartner", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    // Read the image file and convert it to base64 string
    const imageFile = fs.readFileSync(req.file.path);
    const base64Image = imageFile.toString("base64");

    // Create a new Data document and save it to the database
    const newData = new hpData({
      Hiredcount: req.body.hiredcount,
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Title: req.body.title,
      Image: base64Image, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/hiringpartner", async (req, res) => {
  try {
    const allData = await hpData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/hiringpartner/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await hpData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});



// TRAINING & SKILLS API()
// *****************************************************************

const trainingSchema = new mongoose.Schema({
  Title: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },
  Image: String,
});

const trainingData = mongoose.model("Trainings", trainingSchema);

// Route to handle data upload for the Noticeboard
app.post("/training", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    // Read the image file and convert it to base64 string
    const imageFile = fs.readFileSync(req.file.path);
    const base64Image = imageFile.toString("base64");

    // Create a new Data document and save it to the database
    const newData = new trainingData({
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Title: req.body.title,
      Image: base64Image, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/training", async (req, res) => {
  try {
    const allData = await trainingData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/training/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await trainingData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});



// TRACK RECORD API()
// *****************************************************************

const trackrecordSchema = new mongoose.Schema({
  Course: { type: String, required: false },
  Count: { type: String, required: false }
});

const trackrecordData = mongoose.model("Track Record", trackrecordSchema);

// Route to handle data upload for the Noticeboard
app.post("/trackrecord", upload.single("image"), async (req, res) => {
  try {
   
    // Create a new Data document and save it to the database
    const newData = new trackrecordData({
      Course: req.body.course,
      Count: req.body.count
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/trackrecord", async (req, res) => {
  try {
    const allData = await trackrecordData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/trackrecord/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await trackrecordData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});



// CAREER API()
// *****************************************************************

const careerSchema = new mongoose.Schema({
  Description: { type: String, required: false },
  Title: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },
  Image: String,
});

const careerData = mongoose.model("Careers", careerSchema);

// Route to handle data upload for the Noticeboard
app.post("/career", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    const filePromises = req.files.map(processFile);

    // Wait for all the file conversions to complete
    const base64Files = await Promise.all(filePromises);

    // Create a new Data document and save it to the database
    const newData = new careerData({
      Description: req.body.description,
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Title: req.body.title,
      Image: base64Files, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/career", async (req, res) => {
  try {
    const allData = await careerData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});


app.get("/career/:id", async (req, res) => {
  try {
    const recordId = req.params.id;
    const record = await careerData.findById(recordId);
    
    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    return res.status(200).json(record);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/career/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await careerData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

// EXAM CALENDER API()
// *****************************************************************

const examSchema = new mongoose.Schema({
  Description: { type: String, required: false },
  Title: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },

  Image: String,
});

const examData = mongoose.model("Examcalenders", examSchema);

// Route to handle data upload for the Noticeboard
app.post("/examcalender", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

        // Process each uploaded file using streams
        const filePromises = req.files.map(processFile);

        // Wait for all the file conversions to complete
        const base64Files = await Promise.all(filePromises);

    // Create a new Data document and save it to the database
    const newData = new examData({
      Description: req.body.description,
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Title: req.body.title,
      Image: base64Files, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/examcalender", async (req, res) => {
  try {
    const allData = await examData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});


app.get("/examcalender/:id", async (req, res) => {
  try {
    const recordId = req.params.id;
    const record = await examData.findById(recordId);
    
    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    return res.status(200).json(record);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});


app.delete("/examcalender/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await examData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});



// TENDERS API()
// *****************************************************************

const tenderSchema = new mongoose.Schema({
  Description: { type: String, required: false },
  Title: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },

  Image: String,
});

const tenderData = mongoose.model("Tenders", tenderSchema);

// Route to handle data upload for the Noticeboard
app.post("/tender", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    // Read the image file and convert it to base64 string
    // const imageFile = fs.readFileSync(req.file.path);
    // const base64Image = imageFile.toString("base64");


    // Process each uploaded file using streams
    const filePromises = req.files.map(processFile);

    // Wait for all the file conversions to complete
    const base64Files = await Promise.all(filePromises);

    // Create a new Data document and save it to the database
    const newData = new tenderData({
      Description: req.body.description,
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Title: req.body.title,
      Image: base64Files, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/tender", async (req, res) => {
  try {
    const allData = await tenderData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});


app.get("/tender/:id", async (req, res) => {
  try {
    const recordId = req.params.id;
    const record = await tenderData.findById(recordId);
    
    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    return res.status(200).json(record);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/tender/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await tenderData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});



// PHOTO GALLERY API()
// *****************************************************************

const photoSchema = new mongoose.Schema({
  Title: { type: String, required: false },
  Description: { type: String, required: false },
  StartDate: {
    type: Date,
    required: false,
    default: null,
  },
  EndDate: {
    type: Date,
    required: false,
    default: null,
  },
  Image: String,
});

const photoData = mongoose.model("Photo Gallery", photoSchema);

// Route to handle data upload for the Noticeboard
app.post("/photogallery", upload.single('image', 20), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    // Read the image file and convert it to base64 string
    const imageFile = fs.readFileSync(req.file.path);
    const base64Image = imageFile.toString("base64");

    // Create a new Data document and save it to the database
    const newData = new photoData({
      Description: req.body.description,
      StartDate: req.body.startDate,
      EndDate: req.body.endDate,
      Title: req.body.title,
      Image: base64Image, // Store the base64 image string in the Image field
    });

    await newData.save(); // Use the "await" keyword to wait for the save operation to complete

    // Remove the uploaded file after saving the data to the database
    fs.unlinkSync(req.file.path);

    return res.status(200).json({ message: "Data uploaded successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/photogallery", async (req, res) => {
  try {
    const allData = await photoData.find();
    return res.status(200).json(allData);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/photogallery/:id", async (req, res) => {
  try {
    const dataId = req.params.id;
    const deletedData = await photoData.findByIdAndDelete(dataId);
    if (!deletedData) {
      return res.status(404).json({ error: "Data not found." });
    }
    return res.status(200).json({ message: "Data deleted successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
