const {Router} = require('express')

const {registerUser, loginUser, getUser, changeAvatar, editUser, getAuthors} = require('../controllers/userControllers.js')
const authMiddleware = require('../middleware/authMiddleware')

const multer = require('multer')
const storage = multer.memoryStorage()
const _upload = multer({storage: storage})

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/:id', getUser)
router.get('/', getAuthors)
router.post('/change-avatar', authMiddleware, _upload.single('avatar'), changeAvatar)
router.patch('/edit-user', authMiddleware, editUser)

module.exports = router