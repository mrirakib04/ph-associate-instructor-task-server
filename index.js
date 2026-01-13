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
    const categoriesCollection = database.collection("categories");
    const reviewsCollection = database.collection("reviews");
    const tutorialsCollection = database.collection("tutorials");

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
          role: "Reader",
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
    // POST a new book with authorEmail
    app.post("/books", async (req, res) => {
      try {
        const { title, author, genre, description, image, authorEmail } =
          req.body;

        if (!authorEmail) {
          return res.status(400).json({ message: "Author email is required" });
        }

        const newBook = {
          title,
          author,
          genre,
          description,
          image,
          authorEmail,
          createdAt: new Date(),
        };

        const result = await booksCollection.insertOne(newBook);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add book" });
      }
    });
    // POST new category (With Duplicate Check)
    app.post("/categories", async (req, res) => {
      try {
        const { name, authorEmail } = req.body;

        const exist = await categoriesCollection.findOne({
          name: { $regex: `^${name}$`, $options: "i" },
        });

        if (exist) {
          return res.status(400).json({ message: "Category already exists!" });
        }

        const newCategory = { name, authorEmail, createdAt: new Date() };
        const result = await categoriesCollection.insertOne(newCategory);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    });
    // POST a new tutorial
    app.post("/tutorials", async (req, res) => {
      try {
        const { title, videoUrl, authorEmail } = req.body;
        if (!authorEmail) {
          return res.status(400).json({ message: "Author email is required" });
        }
        const newTutorial = {
          title,
          videoUrl, // Expected: YouTube embed link or ID
          authorEmail,
          createdAt: new Date(),
        };
        const result = await tutorialsCollection.insertOne(newTutorial);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add tutorial" });
      }
    });

    // READING
    // GET single user by email
    app.get("/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    });
    // GET all books (with optional search/filter)
    app.get("/books", async (req, res) => {
      try {
        const { search, genre } = req.query;
        let query = {};
        if (search) {
          query.title = { $regex: search, $options: "i" };
        }
        if (genre) {
          query.genre = genre;
        }
        const result = await booksCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching books" });
      }
    });
    // Admin Books
    app.get("/my-books/:email", async (req, res) => {
      const email = req.params.email;
      const query = { authorEmail: email };
      const result = await booksCollection.find(query).toArray();
      res.send(result);
    });
    // GET all categories
    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection.find().toArray();
      res.send(result);
    });
    // GET categories by author email (My Categories)
    app.get("/my-categories/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { authorEmail: email };
        const result = await categoriesCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch your categories" });
      }
    });
    // GET all tutorials
    app.get("/tutorials", async (req, res) => {
      const result = await tutorialsCollection.find().toArray();
      res.send(result);
    });
    // GET tutorials by author email
    app.get("/my-tutorials/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { authorEmail: email };
        const result = await tutorialsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch tutorials" });
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
    // 4. PUT (Update) a book
    app.put("/books/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedBook = req.body;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            title: updatedBook.title,
            author: updatedBook.author,
            genre: updatedBook.genre,
            description: updatedBook.description,
            image: updatedBook.image,
            authorEmail: updatedBook.authorEmail,
            updatedAt: new Date(),
          },
        };

        const result = await booksCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Book not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update book" });
      }
    });
    // PUT (Update) category name
    app.put("/categories/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { name } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { name } };
        const result = await categoriesCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to update" });
      }
    });
    // PUT (Update) tutorial
    app.put("/tutorials/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { title, videoUrl } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { title, videoUrl, updatedAt: new Date() },
        };
        const result = await tutorialsCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to update tutorial" });
      }
    });

    // DELETING
    // DELETE a book
    app.delete("/books/dlt/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await booksCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete book" });
      }
    });
    // DELETE category
    app.delete("/categories/dlt/:id", async (req, res) => {
      const id = req.params.id;
      const result = await categoriesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    // DELETE tutorial
    app.delete("/tutorials/dlt/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await tutorialsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to delete tutorial" });
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
