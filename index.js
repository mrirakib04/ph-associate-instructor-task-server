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
    const myLibraryCollection = database.collection("myLibrary");

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
    // POST a new review
    app.post("/reviews", async (req, res) => {
      try {
        const reviewData = req.body;
        // reviewData should contain: bookId, bookTitle, authorEmail, review, rating, reviewer, reviewerEmail
        const newReview = {
          ...reviewData,
          status: "pending",
          createdAt: new Date(),
        };

        const result = await reviewsCollection.insertOne(newReview);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to post review" });
      }
    });
    // POST a book in your library
    app.post("/my-library", async (req, res) => {
      const {
        bookId,
        userEmail,
        shelf,
        title,
        image,
        author,
        authorEmail,
        totalPages,
      } = req.body;

      const query = { bookId, userEmail };
      const updateDoc = {
        $set: {
          bookId,
          shelf,
          title,
          image,
          author,
          authorEmail,
          userEmail,
          totalPages: totalPages || 0,
          progress: 0,
          addedAt: new Date(),
        },
      };

      const options = { upsert: true };
      const result = await myLibraryCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
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
    // GET all books with Search, Filter and Pagination
    app.get("/books", async (req, res) => {
      try {
        const { search, genre, sort, page = 0, size = 12 } = req.query;

        const pageNumber = parseInt(page);
        const pageSize = parseInt(size);

        let query = {};

        // Search
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { author: { $regex: search, $options: "i" } },
          ];
        }

        // Genre filter
        if (genre) {
          query.genre = { $in: genre.split(",") };
        }

        // Sorting
        let sortOptions = {};
        if (sort === "newest") {
          sortOptions = { createdAt: -1 };
        } else if (sort === "oldest") {
          sortOptions = { createdAt: 1 };
        } else {
          sortOptions = { _id: -1 };
        }

        const books = await booksCollection
          .find(query)
          .sort(sortOptions)
          .skip(pageNumber * pageSize)
          .limit(pageSize)
          .toArray();

        const totalCount = await booksCollection.countDocuments(query);

        res.send({ books, totalCount });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error fetching books" });
      }
    });
    // GET Admin/Author Books with Pagination
    app.get("/my-books/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 10;

        const query = { authorEmail: email };

        const result = await booksCollection
          .find(query)
          .skip(page * size)
          .limit(size)
          .toArray();

        const totalCount = await booksCollection.countDocuments(query);

        res.send({ books: result, totalCount });
      } catch (error) {
        res.status(500).send({ message: "Error fetching your books" });
      }
    });
    // GET all categories
    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection.find().toArray();
      res.send(result);
    });
    // GET categories by author email (My Categories) with Pagination
    app.get("/my-categories/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 10;

        const query = { authorEmail: email };

        const result = await categoriesCollection
          .find(query)
          .skip(page * size)
          .limit(size)
          .toArray();

        const totalCount = await categoriesCollection.countDocuments(query);

        res.send({ categories: result, totalCount });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch your categories" });
      }
    });
    // GET all tutorials (with optional search and pagination)
    app.get("/tutorials", async (req, res) => {
      try {
        const { search, page, size } = req.query;
        const pageNumber = parseInt(page) || 0;
        const limitNumber = parseInt(size) || 9;

        let query = {};
        if (search) {
          query.title = { $regex: search, $options: "i" };
        }

        const totalCount = await tutorialsCollection.countDocuments(query);
        const result = await tutorialsCollection
          .find(query)
          .skip(pageNumber * limitNumber)
          .limit(limitNumber)
          .toArray();

        res.send({ tutorials: result, totalCount });
      } catch (error) {
        res.status(500).send({ message: "Error fetching tutorials" });
      }
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
    // GET all users (For Admin Manage Users page)
    app.get("/users", async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch users" });
      }
    });
    // GET a single book by ID with its reviews
    app.get("/books/data/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Book ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const book = await booksCollection.findOne(query);

        if (!book) {
          return res.status(404).send({ message: "Book not found" });
        }

        const reviews = await reviewsCollection
          .find({ bookId: id, status: "approved" })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ ...book, reviews });
      } catch (error) {
        console.error("Error fetching book details:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    // GET reviews by bookId
    app.get("/reviews/:bookId", async (req, res) => {
      const bookId = req.params.bookId;
      const result = await reviewsCollection
        .find({ bookId: bookId, status: "approved" })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });
    // GET my library
    app.get("/my-library/:email", async (req, res) => {
      const email = req.params.email;
      const result = await myLibraryCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });
    // GET reviews with pagination and status filter
    app.get("/manage-reviews/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const status = req.query.status;
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 10;

        let query = { authorEmail: email };
        if (status) {
          query.status = status;
        }

        const totalCount = await reviewsCollection.countDocuments(query);
        const result = await reviewsCollection
          .find(query)
          .skip(page * size)
          .limit(size)
          .toArray();

        res.send({ reviews: result, totalCount });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch reviews" });
      }
    });
    // GET My Library
    app.get("/my-library/:email", async (req, res) => {
      const email = req.params.email;
      const result = await myLibraryCollection
        .find({ userEmail: email })
        .sort({ addedAt: -1 })
        .toArray();
      res.send(result);
    });
    // GET Admin Stats Dynamic
    app.get("/admin/stats/:email", async (req, res) => {
      try {
        const email = req.params.email;

        // প্যারালালি সব কাউন্ট বের করা (Performance এর জন্য ভালো)
        const [
          totalBooks,
          totalUsers,
          totalCategories,
          totalReviews,
          totalTutorials,
        ] = await Promise.all([
          booksCollection.countDocuments({ authorEmail: email }),
          usersCollection.countDocuments(), // টোটাল ইউজার সবার জন্য সমান
          categoriesCollection.countDocuments({ authorEmail: email }),
          reviewsCollection.countDocuments({ authorEmail: email }),
          tutorialsCollection.countDocuments({ authorEmail: email }),
        ]);

        res.send({
          totalBooks,
          totalUsers,
          totalCategories,
          totalReviews,
          totalTutorials,
        });
      } catch (error) {
        res.status(500).send({ message: "Error fetching stats" });
      }
    });
    // GET User Stats Dynamic
    app.get("/user/stats/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const totalRead = await myLibraryCollection.countDocuments({
          userEmail: email,
          shelf: "Read",
        });

        const inProgress = await myLibraryCollection.countDocuments({
          userEmail: email,
          shelf: "Currently Reading",
        });

        const reviewStats = await reviewsCollection
          .aggregate([
            { $match: { reviewerEmail: email } },
            {
              $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
              },
            },
          ])
          .toArray();

        res.send({
          totalRead,
          inProgress,
          avgRating:
            reviewStats.length > 0 ? reviewStats[0].avgRating.toFixed(1) : 0,
          totalReviews:
            reviewStats.length > 0 ? reviewStats[0].totalReviews : 0,
        });
      } catch (error) {
        res.status(500).send({ message: "Error fetching user stats" });
      }
    });
    // GET 8 latest books for Home Page
    app.get("/home/latest/books", async (req, res) => {
      try {
        const result = await booksCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching latest books" });
      }
    });
    // GET 6 latest tutorials for Home Page
    app.get("/home/latest/tutorials", async (req, res) => {
      try {
        const result = await tutorialsCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching latest tutorials" });
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
    // PATCH/PUT update user role
    app.patch("/users/role/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body; // Expecting { role: "Admin" } or { role: "Reader" }
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { role: role },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Role update failed" });
      }
    });
    // Review Status (Approve)
    app.patch("/reviews/approve/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status: "approved" } };
        const result = await reviewsCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to approve review" });
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
    // DELETE Review
    app.delete("/reviews/dlt/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await reviewsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete review" });
      }
    });
    // DELETE Book from my Library
    app.delete("/my-library/remove/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await myLibraryCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to remove from library" });
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
