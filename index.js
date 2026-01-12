import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 3030;
const app = express();

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://mrirakib-ph-associate-instructor-task-web.vercel.app",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_ACCESS}@cluster0.bfqzn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    // Connections
    const database = client.db(process.env.DB_NAME);
    const usersCollection = database.collection("users");
    const booksCollection = database.collection("books");

    // POSTING
    // REGISTER (POST)
    app.post("/register", async (req, res) => {
      try {
        const { name, email, password, image } = req.body;

        const exist = await usersCollection.findOne({ email });
        if (exist)
          return res.status(400).json({ message: "User already exists" });

        const newUser = {
          name,
          email,
          password,
          image: image || "",
          createdAt: new Date(),
        };

        await usersCollection.insertOne(newUser);

        res.json({ message: "Registered successfully", user: newUser });
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });
    // LOGIN (POST)
    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.password !== password) {
          return res.status(401).json({ message: "Wrong password" });
        }

        res.json({ message: "Login success", user });
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });

    // UPDATING
    // PUT /update-name
    app.put("/update-name", async (req, res) => {
      try {
        const { email, name } = req.body;

        if (!email || !name) {
          return res
            .status(400)
            .json({ message: "Email and Name are required" });
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { name } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found or name unchanged" });
        }

        res.json({ message: "Name updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });
    // PUT /update-photo
    app.put("/update-photo", async (req, res) => {
      try {
        const { email, image } = req.body;

        if (!email || !image) {
          return res
            .status(400)
            .json({ message: "Email and Image URL are required" });
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { image } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found or image unchanged" });
        }

        res.json({ message: "Photo updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BookWorm server");
});

app.listen(port, () => {
  console.log(`BookWorm server listening on port ${port}`);
});
