const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
// will solve deployment of cors interceptor
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9fxhf2q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// jwt middleware(Validate jwt)
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({
            error: true, message: "Unauthorized Access"
        })
    }

    const token = authorization.split(' ')[1];
    //  console.log(token);
    //  verify token
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                error: true, message: "Unauthorized Access"
            })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const courseCollect = client.db('assignment-12').collection('courses');
        const instructorCollection = client.db('assignment-12').collection('instructors');
        const testimonialCollection = client.db('assignment-12').collection('testimonial');
        const selectedCollection = client.db('assignment-12').collection('selected');
        const enrolledCollection = client.db('assignment-12').collection('enrolled');
        const usersCollection = client.db('assignment-12').collection('users');

        // generate client secret
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            if (price) {
                const amount = parseFloat(price) * 100;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card'],
                })
                res.send({ clientSecret: paymentIntent.client_secret })
            }
        })

        // generate jwt
        app.post('/jwt', (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
            res.send({ token });
        })

        // 0. user related apis
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = {email: user.email};
            const alreadyExist = await usersCollection.findOne(query); 
            if(alreadyExist) {
                return res.send({message: "The user already exist"})
            }

            const result = await usersCollection.insertOne(user);
            res.send(result); 
        })
        app.get('/users',verifyJWT, async(req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result); 
        })
        // ToDo: admin security layer (/users/admin/:email)

        // update role
        app.patch('/users/admin/:id', async(req, res) =>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
        })
        app.patch('/users/instructor/:id', async(req, res) =>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const updatedDoc = {
                $set: {
                    role: 'instructor' 
                }
            }
            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        // get user role by email
        app.get('/users/:email', async(req, res) => {
            const email = req.params.email;
            const query = {email: email};
            const result = await usersCollection.findOne(query);
            res.send(result);
        })


        // 1. course related apis

        app.post('/courses',verifyJWT, async (req, res) => {
            const course = req.body;
            const result = await courseCollect.insertOne(course);
            res.send(result); 
        })

        app.get('/courses', async (req, res) => {
            const query = {};
            const options = {
                sort: {
                    "enrolledStudents": -1
                }
            }
            const result = await courseCollect.find(query, options).toArray();
            res.send(result); 
        })
        // update status
        app.patch('/courses/approved/:id', async(req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id)};
            const updatedDoc = {
                $set: {
                    status: 'approved'
                }
            }
            const result = await courseCollect.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.patch('/courses/deny/:id', async(req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id)};
            const updatedDoc = {
                $set: {
                    status: 'deny'
                }
            }
            const result = await courseCollect.updateOne(filter, updatedDoc);
            res.send(result);
        })
        // ToDo: update course student number after payment
        // update course number after enrolled
        // app.patch('/courses/:id', async (req, res) => { 
        //     const id = req.params.id;
        //     const courseData = req.body;
        //     console.log(courseData);
        //     const query = { _id: new ObjectId(id)};
        //     const updatedDoc = {
        //         $set: {
        //             enrolledStudents: courseData.enrolledStudents + 1,
        //             availableSets:courseData.availableSets - 1
        //         }
        //     }
        //     const update = await courseCollect.updateOne(query, updatedDoc);
        //     console.log('update',update);
        //     res.send(update); 
        // })

        // 2.instructors related apis
        app.post('/instructors', async (req, res) => {
            const instructor = req.body;
            const result = await instructorCollection.insertOne(instructor);      
            res.send(result);         
        })
        app.get('/instructors', async (req, res) => {
            const query = {};
            const options = {
                sort: {
                    "students": sort = -1
                }
            }
            const result = await instructorCollection.find(query, options).toArray();
            res.send(result);
        }) 

        // 3. testimonial related apis
        app.post('/testimonials', async (req, res) => {
            const testimonial = req.body;
            const result = await testimonialCollection.insertOne(testimonial);
            res.send(result);
        })
        app.get('/testimonials', async (req, res) => {
            const result = await testimonialCollection.find().toArray();
            res.send(result);
        })

        // 4. select class related apis
        app.post('/selected', async (req, res) => {
            const course = req.body;
            const result = await selectedCollection.insertOne(course);
            res.send(result);
        })
        // get selected course by email
        app.get('/selected', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({
                    error: true, message: "Forbidden Access"
                })
            }
            if (!email) {
                res.send([]);
            }
            const query = { email: email };
            const result = await selectedCollection.find(query).toArray();
            res.send(result);
        })
        app.delete('/selected/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedCollection.deleteOne(query);
            res.send(result);
        })
        app.get('/selected/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedCollection.findOne(query);
            res.send(result);
        })

        // 5. enrolled course related apis
        // save booking-courses info to db
        app.post('/enrolled-courses', async (req, res) => {
            const enroll = req.body;
            const result = await enrolledCollection.insertOne(enroll);
            res.send(result);
        })

        app.get('/enrolled-courses', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const query = { email: email };
            const result = await enrolledCollection.find(query).toArray();
            res.send(result);    
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Assignment 12 is pending..')
})

app.listen(port, () => {
    console.log(`Assignment-12 is running on port: ${port}`)
});