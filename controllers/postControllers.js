
const Post = require('../models/postModel')
const User = require('../models/userModel')
const path = require('path')
const fs = require('fs')
const {v4: uuid} = require('uuid')
const HttpError = require('../models/errorModel')
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
require('dotenv').config()
const crypto = require('crypto')

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

const bucketName =  process.env.BUCKET_NAME
const bucketRegion =  process.env.REGION
const accessKey =  process.env.ACCESS_KEY
const secretAccessKey =  process.env.SECRET_KEY

const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey
    },
    region: bucketRegion
});

// ==================== CREATE A POST
// POST : api/posts
// PROTECTED
const createPost = async (req, res, next) => {
    // res.json("Create Post")

    try {

        let {title, category, description} = req.body;
        if(!title || !category || !description || !req.file){
            return next(new HttpError("Fill in all fields and choose thumbnail.", 422))
        }

        const thumbnail = req.file;
        // check the file size
        if(thumbnail.size > 2000000) {
            return next(new HttpError("Thumbnail too big. File should be less than 2mb."))
        }

        const imageName = randomImageName()

        const params = {
            Bucket: bucketName,
            // Key: req.file.originalname,
            Key: imageName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        }

        const command = new PutObjectCommand(params)
        await s3.send(command)
        
        
        const newPost = await Post.create({title, category, description, thumbnail: `${process.env.AWS_LINK}${imageName}`, creator: req.user.id})
        if(!newPost){
            return next(new HttpError("Post couldn't be created.", 422))
        }
        // find user and increase post count by 1
        const currentUser = await User.findById(req.user.id);
        const userPostCount = currentUser.posts + 1;
        await User.findByIdAndUpdate(req.user.id, {posts: userPostCount})

        res.status(201).json(newPost)
        
    }catch (error){
        console.log(error)
        return next(new HttpError(error)) 
    }
}

// ==================== GET ALL POSTS
// GET : api/posts
// UNPROTECTED
const getPosts = async (req, res, next) => {
    // res.json("Get all Post")
    try {
        const posts = await Post.find().sort({updatedAt: -1})
        res.status(200).json(posts)
    } catch (error){
        console.log(error)
        return next(new HttpError(error))
    }
}

// ==================== GET SINGLE POST
// GET : api/posts/:ID
// UNPROTECTED
const getPost = async (req, res, next) => {
    // res.json("Get a single Post")
    // console.log("req.user.id: ", req.user.id)
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);
        if(!post){
            return next(new HttpError("Post not found.", 404))
        }
        res.status(200).json(post)
    } catch (error){
        return next(new HttpError(error))
    }
}

// ==================== GET POST BY CATEGORY
// GET : api/posts/categories/:category
// UNPROTECTED
const getCatPost = async (req, res, next) => {
    // res.json("Get Post by Category")
    try{
        const {category} = req.params;
        const catPosts = await Post.find({category}).sort({createdAt: -1})
        res.status(200).json(catPosts)
    }catch(error){
        return next(new HttpError(error))
    }
}

// ==================== GET USER/AUTHOR POST
// GET : api/posts/users/:id
// UNPROTECTED
const getUserPosts = async (req, res, next) => {
    // res.json("Get User Post")
    try {
        const {id} = req.params;
        const posts = await Post.find({creator: id}).sort({createdAt: -1})
        res.status(200).json(posts)
    } catch(error){
        return next(new HttpError(error))
    }
}

// ==================== EDIT POST
// PATCH : api/posts/:id
// PROTECTED
const editPost = async (req, res, next) => {
    // res.json("Edit Post")
    // console.log("req.user.id: ", req.user.id)
    try{
        let updatedPost;
        const postId = req.params.id;
        let {title, category, description} = req.body;
        console.log("req.body: ", req.body)
        // ReactQuill has a paragraph opening and closing tag with a break tag in between so there are 11 characters in ther already.
        if(!title || !category || description.length < 12){
        // if(!title || !category || !description){
            return next(new HttpError("Fill in all fields.", 422))
        }
        // get old post from database
        const oldPost = await Post.findById(postId);
        if(!req.file){
            updatedPost = await Post.findByIdAndUpdate(postId, {title, category, description}, {new: true})
        } else {
            // delete old thumbnail from upload
            const oldPostThumbnail = oldPost.thumbnail.substring(process.env.AWS_LINK.toString().length)

            const toDeleteparams = {
                Bucket: bucketName,
                // Key: req.file.originalname,
                Key: oldPostThumbnail
            }

            const command = new DeleteObjectCommand(toDeleteparams)
            await s3.send(command)

            // upload new thumbnail
            const thumbnail = req.file;
            // check file size
            if(thumbnail.size > 2000000){
                return new(new HttpError("Thumbnail too big. Should be less than 2mb."))
            }

            const imageName = randomImageName()

            const params = {
                Bucket: bucketName,
                // Key: req.file.originalname,
                Key: imageName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read'
            }

            const updateCommand = new PutObjectCommand(params)
            await s3.send(updateCommand)

            updatedPost = await Post.findByIdAndUpdate(postId, {title, category, description, thumbnail: `${process.env.AWS_LINK}${imageName}`}, {new: true}) 
        }

        if(!updatedPost){
            console.log('error here!')
            return next(new HttpError("Couldn't update post.", 400))
        }

        res.status(200).json(updatedPost)
    }catch(error){
        return next(new HttpError(error))
    }
}

// ==================== DELETE POST
// DELETE : api/posts/:id
// PROTECTED
const deletePost = async (req, res, next) => {
    // res.json("Delete Post")
    // console.log("req.user.id: ", req.user.id)
    try{
        const postId = req.params.id;
        if(!postId){
            return next(new HttpError("Post unavailable.", 400))
        }
        const post = await Post.findById(postId);
        const fileName = post?.thumbnail;
        if(req.user.id == post.creator){
            // delete thumbnail from uploads folder
            fs.unlink(path.join(__dirname, '..', 'uploads', fileName), async(err)=>{
                if(err){
                    return next(new HttpError(err))
                } else {
                    await Post.findByIdAndDelete(postId);
                    // find user and reduce post count by 1
                    const currentUser = await User.findById(req.user.id);
                    const userPostCount = currentUser?.posts - 1;
                    await User.findByIdAndUpdate(req.user.id, {posts: userPostCount})
                    res.json(`Post ${postId} deleted successfully.`)
                }
            })
        }else{
            return next(new HttpError("Post couldn't be deleted.", 403))
        }
    }catch (error){
        console.log("ERROR HERE", error)
        return next(new HttpError(error))
    }
    
}

module.exports = {createPost, getPosts, getPost, getCatPost, getUserPosts, editPost, deletePost}