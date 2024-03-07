const {Router} = require('express')

const {createPost, getPosts, getPost, getCatPost, getUserPosts, editPost, deletePost} = require('../controllers/postControllers')
const authMiddleware = require('../middleware/authMiddleware')

const multer = require('multer')
const storage = multer.memoryStorage()
const _upload = multer({storage: storage})

const router = Router()

router.post('/', authMiddleware, _upload.single('thumbnail'), createPost)
router.get('/', getPosts)
router.get('/:id', getPost)
router.patch('/:id', editPost)
router.get('/categories/:category', getCatPost)
router.get('/users/:id', getUserPosts)
router.patch('/:id', authMiddleware, editPost)
router.delete('/:id', authMiddleware, deletePost)

module.exports = router