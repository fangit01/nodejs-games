var express = require("express");
var methodOverride = require('method-override');
var app = express();
require('dotenv').config();
var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var bodyPaser = require("body-parser");
var expressSession = require("express-session");
var passport = require ("passport");
var LocalStrategy = require('passport-local').Strategy;
var passportLocalMongoose = require('passport-local-mongoose');
var flash = require('connect-flash');
var expressSanitizer = require("express-sanitizer");




app.use(bodyPaser.urlencoded({extended:true}));
app.use(methodOverride('_method'));
app.use(expressSanitizer());
mongoose.Promise = global.Promise;
app.set('view engine','ejs');
app.use('/public', express.static('public'));
var moment = require('moment');
app.use(expressSession({
    secret: "shijiejingtoulengkuxianjing",
    resave:false,
    saveUninitialized:false

}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());


app.use(function(req,res,next){
    res.locals.currentUser = req.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

app.locals.moment = moment;
// ----------------------- database -------------------------------
mongoose.connect(process.env.databaseUri, {useMongoClient: true, promiseLibrary: global.Promise});

var myUserSchema = new Schema({
    //username: {type: String, unique: true, required: true, minlength: 1}, 
    //password: {type: String, required: true, minlength: 1},
    //-------------------above is not needed as Passport-Local Mongoose will add a username, hash and salt field to store the username, 
     //-------------------the hashed password and the salt value.
    email: {type: String, unique: true},
    admin: {type: Boolean, default:false},
    },
    {timestamps: true }
);

myUserSchema.plugin(passportLocalMongoose); //must before var User = mongoose.model('user', myUserSchema);
var User = mongoose.model('user', myUserSchema);

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

var myCommentSchema = new Schema({
    onGame: {type: String},
    image: {type: String},
    by:{ type: Schema.Types.ObjectId, ref: 'User' },
    content:{type: String},
    },
    {timestamps: true }
);

var Comment = mongoose.model('comment', myCommentSchema);

var myGameSchema = new Schema({
    gameName:   {type: String, required: true, unique: true},
    image:      {type: String, required: true},
    price:      {type: Number, required: true},
    category:   {type: String, required: true},
    genre:      {type: String},
    comments:   [{type: mongoose.Schema.Types.ObjectId,ref: "Comment"}],
    description:{type: String, default: 'no description added'},
    releaseDate:{type: Date, default: new Date() }
    }, 
    {timestamps: true }
);

var Game = mongoose.model('game', myGameSchema);




// ----------------------- route -------------------------------
app.get('/', (req,res)=>{
    var noMatch = null;
    if(req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'gi'); // function is below
        Game.find({gameName:regex}, null, {sort: '-createdAt'}, function(err,searchResult){
            if(err) {
               console.log(err);
            } else {
                if(searchResult.length < 1) {
                noMatch = "cannot found anything of your search, please try another keyword.";
                }
                res.render('search-result.ejs',{searchResult:searchResult,noMatch:noMatch}); 
            }
        });
    } else {
    let perPage = 6;
    let page = (req.query.page === undefined) ? 1 : req.query.page;
    let sortBy = {};
    let sortQuery = req.query.sortby;
    if(sortQuery === 'releasedate') {
            sortBy = {releaseDate:-1}
        }else if(sortQuery === 'highprice') {
            sortBy = {price:-1}
        }else if(sortQuery === 'lowprice') {
            sortBy = {price:1}
        }else{
            sortBy = {createdAt:-1}
        };
    Game.find().limit(perPage).skip(perPage * (page-1)).sort(sortBy)
    .exec( (err, foundGames) => {
        Game.count().exec( (err, count) =>{
            res.render('home', {foundGames,sortQuery, page, pages: Math.ceil(count/perPage)
            })
          })
  });}  
})


app.post('/games', isAdmin,  (req,res)=>{
    var gameName = req.sanitize(req.body.gameName);
    var image = req.sanitize(req.body.image);
    var price = req.body.price;
    var category = req.sanitize(req.body.category);
    var releaseDate = req.body.releaseDate;
    var genre = req.sanitize(req.body.genre);
    var description = req.sanitize(req.body.description);

    var newGame = {gameName,image,price,category,releaseDate, genre,description};
    Game.create(newGame,(err,result)=>{
        if(err) {
            console.log(err);
        } else {
           req.flash("success"," success! new game added!")
            res.redirect('/'); 
        }
    }) 
})




app.get('/add', (req,res)=>{
    res.render('add');
})

/*
app.get('/games/:gamename', function(req,res){
    Game.findOne({'gameName':req.params.gamename},function(err,foundGame){
        if(err || !foundGame) {
            console.log(err);
            req.flash("error","no game found in database");
        } else{
            res.render('game-info.ejs', {foundGame});
        }
    });
});
*/
app.get('/games/:gamename', function(req,res){
    Game.findOne({'gameName':req.params.gamename}).populate({ path: 'comments', model: Comment,populate:{ path: 'by', model: User }}).exec(function(err,foundGame){
        if(err || !foundGame) {
            req.flash("error","no game found in database");
            res.redirect('back');
        } else{
            res.render('game-info.ejs', {foundGame});
        }
    });
});    

app.get('/games/category/:cat', function(req,res){
    Game.find({'category':req.params.cat},function(err,foundCat){
        var paramsCat = req.params.cat;
        if(err || foundCat.length < 1) {
            req.flash("error","no game found in database");
            res.redirect('/');
        } else{
            res.render('category.ejs', {foundCat,paramsCat});
        }
    });
});    

app.get('/games/other-categories/upcoming-games', function(req,res){
    var today = new Date();
    Game.find({'releaseDate':{$gt: today}},function(err,preOrder){
        if(err || !preOrder) {
            console.log(err);
            req.flash("error","no game found in database");
        } else{
            res.render('upcoming-games.ejs', {preOrder});
        }
    });
});   


app.get('/games/other-categories/new-release', function(req,res){
    var today = Date.now();
    Game.find({'releaseDate':{$gt: new Date(Date.now()-(30 * 24 * 60 * 60 * 1000)), $lte: today}},function(err,newRelease){
        if(err || !newRelease) {
            console.log(err);
            req.flash("error","no game found in database");
        } else{
            res.render('new-release.ejs', {newRelease});
        }
    });
});   


app.get('/signup', (req,res)=>{
	res.render('signup');
})

app.get('/login', (req,res)=>{
	res.render('login');
})


app.get('/games/:gamename/edit',(req,res)=>{
	Game.findOne({'gameName':req.params.gamename}, (err,foundGame)=>{
	res.render('edit',{foundGame})})

})

app.put('/games/:gamename',isAdmin,(req,res)=>{
	var gameName = req.sanitize(req.body.gameName);
	var image = req.sanitize(req.body.image);
	var price = req.body.price;
	var category = req.body.category;
	var releaseDate = req.body.releaseDate;
	var genre = req.body.genre;
	var description = req.sanitize(req.body.description);
	var newContent = {gameName,image,price,category,releaseDate, genre,description};
	Game.findOneAndUpdate({gameName:req.params.gamename}, newContent, (err,result)=>{
		if(err || !result){
            res.redirect('back')
        } else {
        req.flash("success"," Game Info Updated");
		res.redirect('/games/' + gameName )}
	})
})


app.delete('/games/:gamename',isAdmin, (req,res)=>{
	Game.findOneAndRemove({gameName:req.params.gamename},(err,result)=>{
		if(err){console.log(err)} else {
        res.redirect('/'); 
    }
	})
})


app.post('/signup', (req,res)=>{
    User.register(new User({ username : req.sanitize(req.body.username),email:req.body.email}), req.body.password, function(err, account) {
        if (err) {
            req.flash("error",err.message);
            return res.redirect('signup');
        }
        passport.authenticate('local')(req, res, function () {
        req.flash("success"," Welcome back!");
          res.redirect('/');
        });
    });
    
    //res.redirect('login');
})


app.post("/login",passport.authenticate("local",{
    successRedirect: "/",
    successFlash: 'Welcome back!',
    failureRedirect: "/login",
    failureFlash: true
    }),
 function(req,res){
   
 });


 app.get("/logout",function(req,res){
    req.logout();
    req.flash("success","successfully logged out")
     res.redirect("/");
 });

 app.get("/cart",function(req,res){
     res.render("cart");
 });



 app.get('/games/:gamename/comment/add', function(req,res){
    Game.findOne({gameName:req.params.gamename},function(err,foundGame){
        if(err || !foundGame ) {
            req.flash("error"," error! game/comment not found!")
            res.redirect("/");
        } else{
            res.render('add-comment.ejs', {foundGame:foundGame}); 
        }
    });
   }); 


app.post('/games/:gamename/comment', isLoggedIn, function(req,res){
    Game.findOne({gameName:req.params.gamename},function(err,foundGame){
        if(err || !foundGame) {
            req.flash("error"," error! game not found!")
            res.redirect("/");
        } else{
            var onGame = req.sanitize(req.params.gamename);
            var by = req.user.id;
            var content = req.sanitize(req.body.content);
            var image = req.sanitize(foundGame.image);
            var newComment = {onGame,by,content,image};
            Comment.create(newComment,function(err,comment){
                if(err){
                    console.log(err);
                } else{                    
                    // comment.author.id = req.user._id;
                    // comment.author.username= req.user.username;

                    // foundGame.comments.push(comment); not woking aymore, so change to concat
                    foundGame.comments = foundGame.comments.concat(comment);
                    foundGame.save();
                    req.flash("success"," success! comment added!")
                    res.redirect('/games/' + req.params.gamename);
                    
                }
            });
        }
    });
});    



app.delete('/games/:gamename/comment/:comment_id',checkCommentOwnership, function(req,res){
    Comment.findByIdAndRemove(req.params.comment_id, function(err,result){
        if(err || !result) {
            req.flash("error"," error! game/comment not found!")
            res.redirect("/");
        } else{
            req.flash("success","Comment Deleted!");
            res.redirect('back'); 
            //res.redirect('/games/' + req.params.gamename); 
        }
    });
   });   

app.get('/dashboard', isLoggedIn, function(req,res){
    Comment.find({'by':req.user.id}).populate({ path: 'by', model: User}).sort("-createdAt").exec(function(err,foundComment){
        if(err || !foundComment) {
            req.flash("error","no comments by you.")
            res.redirect('back'); 
        } else{
            res.render('dashboard',{foundComment}); 
        }
    });
})



// ----------------------- listen port -------------------------------
app.listen(process.env.PORT ||8080,function(){
    console.log ('server started.......')
   });




//search expression -----------------// 
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

//middleware to check isAdmin -----------------//
function isLoggedIn (req,res,next){
    if(req.isAuthenticated()) {
        return next();
    }
    req.flash("error","error! please login first.");
    res.redirect("/login");
};

//middleware to check isAdmin -----------------//
function isAdmin (req,res,next){
    if(req.isAuthenticated() && req.user.admin == true) {
        return next();
    } else {
    req.flash("error","only admin account is allowed to do this.");
    res.redirect("/login");
    }
};

//middleware to checkCommentOwnership -----------------//
function checkCommentOwnership (req,res,next){
        if(req.isAuthenticated()){ 
            Comment.findById(req.params.comment_id, function(err, foundComment){
                if(err || !foundComment){
                    req.flash("error","comment not found!");
                    res.redirect("back")} else{ 
                    if (foundComment.by == req.user.id || req.user.admin == true){
                    next();
                }else{
                    req.flash("error","only the the user who created this comment can delete it!")
                    res.redirect("back")}
                }   
            })
        } else {res.redirect ("/login");} 
    }




// ----------------------- DATABASE seed file -------------------------------

   var seedGames = [{
    "gameName": "Pokemon RPG (Working Title)",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/c25529cf3c46441d8875dd5f0f18587e_Medium.png",
    "price": 99,
    "category": "switch",
    "genre": "action",
	"comments":[],
    "releaseDate": "2019-12-31T00:00:00.000Z",
    "description": "<img src='https://s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/225667_detial_01.jpg'><p>Stay tuned for more information.<\/p>",
    "__v": 0
},
{
    "gameName": "Red Dead Redemption 2",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/2838221d079c41b3b015dc8909a78871_Medium.png",
    "price": 79,
    "category": "xbox-one",
    "genre": "role-playing",
    "comments":[],
    "releaseDate": "2018-12-31T00:00:00.000Z",
    "description": "<p><img src='//content.ebgames.com.au/website/images/detail/rdr2_detail.jpg'><\/p>Developed by the creators of Grand Theft Auto V and Red Dead Redemption, Red Dead Redemption 2 is an epic tale of life in America\u2019s unforgiving heartland. The game's vast and atmospheric world will also provide the foundation for a brand new online multiplayer experience.",
    "__v": 0
},
{
    "gameName": "Elder Scrolls V: Skyrim",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/d0e45e70e3e44c7aa5100a02ab074205_Medium.png",
    "price": 79,
    "category": "switch",
    "genre": "role-playing",
    "comments":[],
    "releaseDate": "2017-11-17T00:00:00.000Z",
    "description": "<div><p><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/217625_detail_01.jpg'><\/p><p><strong>Live another life, in another world \u2013 from battling ancient dragons to exploring rugged mountains \u2013 in the legendary open-world masterpiece from Bethesda Game Studios.<\/strong><\/p><div><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/217625_detail_02.jpg'><\/div><ul><li><strong>Epic Fantasy Reborn<\/strong> \u2013 Skyrim reimagines the open-world fantasy epic, pushing the gameplay and technology of a virtual world to new heights.<\/li><li><strong>Live another life, in another world<\/strong> \u2013 Play any type of character you can imagine, and do whatever you want; the legendary freedom of choice, storytelling, and adventure of The Elder Scrolls is realized like never before.<\/li><li><strong>Stunning Graphics and Immersive Gameplay<\/strong> \u2013 Skyrim's game engine brings to life a complete virtual world with rolling clouds, rugged mountains, bustling cities, lush fields, and ancient dungeons.<\/li><li><strong>You Are What You Play<\/strong> \u2013 Choose from hundreds of weapons, spells, and abilities. The character system allows you to play any way you want and define yourself through your actions<\/li><li><strong>The Legend of Zelda Outfits and Weapons<\/strong> \u2013 Tap compatible The Legend of Zelda character amiibo to gain outfits and gear inspired by the series. Take down enemies with the Master Sword, protect yourself with the Hylian shield, or look heroic in the Champion\u2019s Tunic. Tap other compatible amiibo to gain additional loot. Compatible amiibo include those from The Legend of Zelda: Breath of the Wild series, 30th Anniversary - The Legend of Zelda series, Super Smash Bros. series, and The Legend of Zelda series.<\/li><li><strong>Motion Controls:<\/strong> Use all-new motion controls for combat and lockpicking \u2013 battle with melee weapons, aim your bow and arrow, and more.<\/li><\/ul><div><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/217625_detail_03.jpg'><\/div><div><p>The High King of Skyrim has been murdered. Alliances form as claims to the throne are made. In the midst of this conflict, a far more dangerous, ancient evil is awakened. Dragons, long lost to the passages of the Elder Scrolls, have returned to Tamriel. The future of Skyrim, even the Empire itself, hangs in the balance as they wait for the prophesized Dragonborn to come; a hero born with the power of The Voice, and the only one who can stand amongst the dragons.<\/p><div><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/217625_detail_05.jpg'><\/div><div><\/div><p>Winner of more than 200 Game of the Year Awards, The Elder Scrolls V: Skyrim, the epic fantasy from Bethesda Game Studios, arrives for Nintendo Switch. The legendary open-world adventure where you can be anyone and do anything, now allows you to go anywhere \u2013 at home on your TV or on the go. The Elder Scrolls V: Skyrim for Nintendo Switch includes all-new gameplay features like motion controls for combat and lockpicking, outfits and gear from The Legend of Zelda, plus additional loot unlocked from compatible The Legend of Zelda amiibo figures. Take down enemies with the Master Sword, protect yourself with the Hylian Shield or look heroic in the Champion\u2019s Tunic. Skyrim also includes all official add-ons \u2013 Dawnguard, Hearthfire, and Dragonborn.<\/p><p><\/p><\/div><div><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/217625_detail_04.jpg'><\/div><\/div>",
    "__v": 0
},
{
    "gameName": "Super Mario Odyssey",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/97d318e7eb9c4da9aed299eb9cbb252a_Medium.png",
    "price": 79,
    "category": "switch",
    "genre": "role-playing",
    "comments":[],
    "releaseDate": "2017-10-27T00:00:00.000Z",
    "description": "<p><img src='https://www.jbhifi.com.au/FileLibrary/ProductResources/Image/218463.jpg'><\/p><p>Embark on a cap-tivating, globe-trotting adventure!<\/p><p>Join Mario on a massive, globe-trotting 3D adventure and use his incredible new abilities to collect Moons so you can power up your airship, the Odyssey, and rescue Princess Peach from Bowser\u2019s wedding plans! This sandbox-style 3D Mario adventure\u2014the first since 1996\u2019s beloved Super Mario 64 and 2002\u2019s Nintendo GameCube classic Super Mario Sunshine\u2014is packed with secrets and surprises, and with Mario\u2019s new moves like cap throw, cap jump, and capture, you\u2019ll have fun and exciting gameplay experiences unlike anything you\u2019ve enjoyed in a Mario game before. Get ready to be whisked away to strange and amazing places far from the Mushroom Kingdom!<\/p><p><strong>Key Features<\/strong><\/p><p>Explore huge 3D kingdoms filled with secrets and surprises, including costumes for Mario and lots of ways to interact with the diverse environments\u2014such as cruising around them in vehicles that incorporate the HD Rumble feature of the Joy-Con™ controller or exploring sections as Pixel Mario.<\/p><p>Thanks to his new friend, Cappy, Mario has brand-new moves for you to master, like cap throw, cap jump and capture. With capture, Mario can take control of all sorts of things, including objects and enemies!<\/p><p>Visit astonishing new locales, like skyscraper-packed New Donk City, and run into familiar friends and foes as you try to save Princess Peach from Bowser\u2019s clutches and foil his dastardly wedding plans.<\/p><p>A set of three new amiibo™ figures*\u2014Mario, Princess Peach and Bowser in their wedding outfits\u2014will be released at launch. Some previously released amiibo will also be compatible with this title. Tap supported amiibo to receive gameplay assistance\u2014some amiibo will also unlock costumes for Mario when scanned!<\/p><p>*amiibo sold separately<\/p><p><\/p><p align='center'><div><iframe id='c844e461-c984-4751-815f-a180df26c884' src='https://www.youtube.com/embed/wGQHQc_3ycE'><\/iframe><\/div><\/p>",
    "__v": 0
},
{
    "gameName": "Star Wars Battlefront 2 Elite Trooper Deluxe Edition",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/2350d2005c8441f7ba4fabe399d13df2_Medium.png",
    "price": 119,
    "category": "xbox-one",
    "genre": "fps",
    "comments":[],
    "releaseDate": "2017-11-17T00:00:00.000Z",
    "description": "<div><div><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/217361_deatil_01.jpg'><\/div><p><em>Master your own Star Wars hero\u2019s journey.<\/em><\/p><p>Embark on an endless Star Wars™ action experience from the bestselling Star Wars HD videogame franchise of all time.<\/p><p>Rush through waves of enemies on Starkiller Base with the power of your lightsaber in your hands. Storm through the jungle canopy of a hidden Rebel base on Yavin 4 with your fellow troopers, dispensing firepower from AT-STs. Line up your X-wing squadron for an attack on a mammoth First Order Star Destroyer in space. Or rise as a new Star Wars hero \u2013 Iden, an elite Imperial special forces soldier \u2013 and discover an emotional and gripping single-player story spanning thirty years.<\/p><p>Experience rich and living Star Wars multiplayer battlegrounds across all three eras: prequel, classic, and new trilogy. Customize and upgrade your heroes, starfighters, or troopers, each with unique abilities to exploit in battle. Ride tauntauns or take control of tanks and speeders. Down Star Destroyers the size of cities, use the Force to prove your worth against iconic characters such as Kylo Ren, Darth Maul, or Han Solo, as you play a part in a gaming experience inspired by 40 years of timeless Star Wars films.<\/p><p>You can become the master of your own Star Wars hero\u2019s journey.<\/p><p><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/225523_detail_06.jpg'><\/p><p><strong>A New Hero, a Story Untold<\/strong><\/p><ul><li>Jump into the boots of an elite special forces soldier, equally lethal on the ground and space, in an emotionally gripping new Star Wars™ campaign that spans over 30 years and bridges events between the films\u2019 Star Wars™: Return of the Jedi™ and Star Wars™: The Force Awakens™.<\/li><\/ul><p><strong>The Ultimate Star Wars Battleground<\/strong><\/p><ul><li>A Star Wars multiplayer universe unmatched in variety and breadth where up to 40 players fight as iconic heroes, authentic-to-era troopers and in a massive array of vehicles on land and in the air \u2013 as battle rages through the galaxy.<\/li><\/ul><p><strong>Galactic-Scale Space Combat<\/strong><\/p><ul><li>Space combat has been designed for Star Wars™ Battlefront™ II from the ground up with distinct handling, weapons and customization options. Join your squadron and weave in between asteroids fields, fly through Imperial Dock Yards and take down massive capital ships as you pilot legendary starfighters in high stakes dogfights with up to 24 players and 40 AI ships.&nbsp;<\/li><\/ul><p><strong>Better Together<\/strong><\/p><ul><li>Team up with a friend from the comfort of your couch with two-player offline split-screen play*. Earn rewards, customize your troopers and heroes, and bring your upgrades with you on the online multiplayer battleground.&nbsp;<\/li><\/ul><p><strong>Master Your Hero<\/strong><\/p><ul><li>Not just an iconic hero- your hero. Master your craft with customizable character progression. Equip ability modifiers, unique to each hero, trooper class, and starfighter. Use these ability modifiers to adapt and modify your character\u2019s core powers, either as lethal active effects on your opponents, helpful status boosts, or tactical assistance, to counter any opponent on the battlefront.<\/li><\/ul><p><em>*split-screen co-op only available on PlayStation 4 and Xbox One<\/em><\/p><p><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/225523_detail_08.jpg'><\/p><\/div>",
    "__v": 0
},
{
    "gameName": "The Legend of Zelda: Breath of the Wild",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/e1219da38fa9438facf1381838bb99be_Medium.png",
    "price": 69,
    "category": "switch",
    "genre": "role-playing",
    "comments":[],
    "releaseDate": "2017-03-03T00:00:00.000Z",
    "description": "<div><p><a href='https://www.ebgames.com.au/featured/nintendo-amiibo?utm_source=eb%20games&amp;utm_medium=toysbanneramiibo&amp;utm_campaign=toysbanneramiibo'><img src='//content.ebgames.com.au/website/images/detail/banner_20150820_amiibo_v2.jpg' style='padding-bottom:5px;'><\/a><br><a href='http://www.nintendo.com/amiibo/compatibility/' target='_blank'><img src='//content.ebgames.com.au/website/images/detail/compatibility-chart.jpg'><\/a><\/p><div><img src='//content.ebgames.com.au/website/images/detail/154351_detail.jpg'><\/div><div>&nbsp;<\/div><div><em>The Legend of Zelda: Breath of the Wild<\/em>&nbsp;represents the next great boundary-breaking adventure from Nintendo. The game marks a new pinnacle for the franchise, featuring challenges and surprises for players at every turn, while giving them incredible freedom to explore the massive world found in this open-air adventure.<\/div><p><em>The Legend of Zelda: Breath of the Wild<\/em>&nbsp;takes the franchise to new heights. As players investigate Hyrule, they can explore the game any way they want because the world is so vast and players are not required to take a pre-determined path.<\/p><div><img src='//content.ebgames.com.au/website/images/detail/154351_detail_01.jpg'><\/div><p>Link needs to be resourceful as he explores his environment. It\u2019s important for players to become familiar with their surroundings so they can find weapons or collect them from defeated enemies. Food helps Link sustain his hearts and can give him a temporary boost or ability that will sustain him.<\/p><div><img src='//content.ebgames.com.au/website/images/detail/154351_detail_04.jpg'><\/div><p>The game breaks with some conventions from the series. For example, many of the minor enemies are no longer scattered randomly around the world, as many now live together in colonies. Link can climb towers and massive structures to get a bearing on his surroundings. He can even reach the top of mountains \u2013 any mountain he can see, he can climb. He can paraglide to lower areas or even use his shield to slide down a mountain. Link will travel across fields, through forests and to mountain peaks.<\/p><div><img src='//content.ebgames.com.au/website/images/detail/154351_detail_02.jpg'><\/div><p>The game\u2019s wild world surrounds Link, and he must pay attention to changes in climate, as a shift in weather or temperature can affect the environment and his ability to survive in it. A sudden downpour might douse a roaring campfire or a lightning storm might be attracted to Link\u2019s metallic weapons. Players might need to bundle up with warmer clothes or change into something better suited to the desert heat.<\/p><div><img src='//content.ebgames.com.au/website/images/detail/154351_detail_03.jpg'><\/div><p>More than 100 Shrines of Trials dot the landscape, waiting for players to discover and explore them in any order they want. As players work their way through the traps and puzzles inside, they\u2019ll earn special items and other rewards that will help them on their adventure. Puzzles in the game often have multiple answers, and secrets can be found everywhere. Exploration and discovery are a huge part of the fun.<\/p><\/div>",
    "__v": 0
},
{
    "gameName": "Ni No Kuni II: Revenant Kingdom",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/65ae03706861496886d0b53c5f1492da_Medium.png",
    "price": 79,
    "category": "ps4",
    "genre": "role-playing",
    "comments":[],
    "releaseDate": "2018-01-19T00:00:00.000Z",
    "description": "<div><div><img src='//content.ebgames.com.au/website/images/detail/212789_detailv2.jpg'><\/div><p>Re-enter the animated world of Ni no Kuni in the sequel to the role-playing masterpiece developed by LEVEL-5.&nbsp;<\/p><p>Explore a beautifully crafted world and experience the gripping story in an all-new RPG adventure. LEVEL-5 reunites with Yoshiyuki Momose on character design and Music created by Joe Hisaishi in the production of the next Ni no Kuni tale.&nbsp;<\/p><div><img src='//content.ebgames.com.au/website/images/detail/226111_detail_01.jpg'><\/div><ul><li><strong>All \u2013Star Production -<\/strong>&nbsp;LEVEL-5\u2019s mastery of the RPG genre is combined with music created by the renowned Joe Hisaishi and character designs by animation artist Yoshiyuki Momose<\/li><li><strong>Captivating Story -&nbsp;<\/strong>&nbsp;A charming and tragic tale unfolds as Even, a boy prince learns how to become a leader and build a kingdom<\/li><li><strong>Playing Mastery -&nbsp;<\/strong>New and traditional RPG elements expertly crafted and designed featuring dozens of locations to explore, hundreds of creatures to battle and a wealth of quests and secrets to uncover throughout the sweeping journey.<\/li><\/ul><div><img src='//content.ebgames.com.au/website/images/detail/226111_detail_02.jpg'><\/div><ul><li><strong>Another World -&nbsp;<\/strong>Stunning visuals to recreate the world of Ni no Kuni and immerse players into an incredibly vibrant, animated land filled with a new cast of delightful characters to meet.<\/li><li><strong>Dynamic Fights -<\/strong>&nbsp;Battle against fierce foes untilizing an exciting real-time battle system.<\/li><\/ul><\/div>",
    "__v": 0
},
{
    "gameName": "Xenoblade Chronicles 2",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/185ab074ac874c47b82e77508832f473_Medium.png",
    "price": 79,
    "category": "switch",
    "genre": "role-playing",
    "comments":[],
    "releaseDate": "2017-12-01T00:00:00.000Z",
    "description": "<div><div><img src='//content.ebgames.com.au/website/images/detail/217633_detail_01v3.jpg'><\/div><h2>Lead Rex, Pyra, and the world to refuge<\/h2><ul><li>A new story in the Xenoblade Chronicles™ series<\/li><li>The next adventure is on the Nintendo Switch™ console\u2014set on the backs of colossal, living Titans<\/li><li>Discover each Titan\u2019s diverse regions, culture, wildlife, equipment, and hidden secrets<\/li><li>Find, bond with, and command weaponized life forms known as Blades to earn abilities and enhance them<\/li><li>Uncover the history of Alrest and the mystery of its endless ocean of clouds<\/li><\/ul><div><img src='//content.ebgames.com.au/website/images/detail/217633_detail_02v3.jpg'><\/div><p>As the giant beasts march toward death, the last hope is a scavenger named Rex\u2014and Pyra, a living weapon known as a Blade. Can you find the fabled paradise she calls home? Command a group of Blades and lead them to countless strategic victories before the world ends.<\/p><p>Each Titan hosts its own distinct cultures, wildlife, and diverse regions to explore. Search the vast open areas and labyrinthine corridors for treasure, secret paths, and creatures to battle and index.<\/p><p>During these escapades you'll get to know a large cast of eclectic characters, including the weaponized life forms known as Blades. Gather these allies, bond with them to increase their power, and utilize their special ARTS to devastate enemies. But to save the world of Alrest, you must first demystify its cloudy past.<\/p><\/div>",
    "__v": 0
},
{
    "gameName": "FIFA 18",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/0e8415c6550743a3944a29d8b19c01dc_Medium.png",
    "price": 99,
    "category": "xbox-one",
    "genre": "sports",
    "comments":[],
    "releaseDate": "2017-09-30T00:00:00.000Z",
    "description": "<div><div><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/banner_standard_FIFA18.jpg'><\/div><div>&nbsp;<\/div><div><strong>Preorder FIFA 18 to receive:<\/strong><\/div><ul><li>5 Jumbo Premium Gold Packs - <em>1 Per Week for 5 Weeks<\/em><\/li><li>Cristiano Ronaldo Loan - <em>5 FUT Matches<\/em><\/li><li>8 Special Edition FUT Kits - <em>Designed by Soundtrack Artists<\/em><\/li><\/ul><div><img src='//s3-ap-southeast-2.amazonaws.com/ebgames-au-cdn/website/images/detail/225563_detail_01.jpg'><\/div><p>Powered by Frostbite™, EA SPORTS™ FIFA 18 blurs the line between the virtual and real worlds, bringing to life the players, teams, and atmospheres that immerse you in the emotion of The World\u2019s Game. The biggest step in gameplay innovation in franchise history, FIFA 18 introduces Real Player Motion Technology, an all-new animation system which unlocks a new level of responsiveness, and player personality \u2013 now Cristiano Ronaldo and other top players feel and move exactly like they do on the real pitch. Player Control combined with new Team Styles and Positioning give you the tools to deliver Dramatic Moments that ignite Immersive Atmospheres around the world. The World\u2019s Game also takes you on a global journey as Alex Hunter Returns along with a star-studded cast of characters, including Cristiano Ronaldo and other European football stars. And in FIFA Ultimate Team™, FUT ICONS, featuring Ronaldo Nazário and other football legends, are coming to FIFA 18.<\/p><p><strong>Powered by Frostbite<\/strong><\/p><p>Attention to innovation in true-to-life action, new football worlds and character depth, Frostbite helps to further blur the lines between the virtual and real worlds. Using movie studio-style advanced shadowing and occlusion techniques to benefit character rendering and overall pitch presentation, FIFA 18 delivers the most visually arresting and authentic football simulation ever.<\/p><p><strong>Player Control<\/strong><\/p><ul><li>Real Player Motion Technology: The all-new, game-changing animation system utilizes pose trajectory matching on every frame to deliver the franchise\u2019s most responsive and fluid gameplay ever. New motion capture techniques and frame by frame animation transitions ensure gameplay accurately represents the reality of football. Real Player Motion Tech is the catalyst for an increased fidelity in movement for every player on the pitch, immediately taking authenticity to another level.<\/li><li>Player Personality: Six new character archetypes and new player mapping technology differentiate players on the pitch to give them their own distinct identity. For the first time ever, real-world movements, size and attributes inform how a player moves, allowing you to feel the life-like tendencies of the world\u2019s best. Ronaldo\u2019s signature sprint, Sterling\u2019s unique turns, and Robben\u2019s distinct arm movement are all immediately recognizable in FIFA 18.<\/li><li>Dribbling Overhaul: In FIFA 18, you will run at defenders with confidence knowing that the best players can change direction on a dime. New dribbling mechanics enable players to inject more creativity into 1v1 situations. Take more defined touches, make tighter turns, and explode into attack more dynamically than ever before.<br><ul><li>Responsive: Creative on-ball skills, contextual touches, and a re-imagining of the control dribble mechanic give players new options when building up attacks in tight spaces. Change direction with ease and feel your player respond when you escape a defender lunging to tackle.<\/li><li>Explosive: Authentic and dynamic speed-based animations allow you to explode more rapidly from controlled touches into full tilt sprints.<\/li><\/ul><\/li><\/ul><p><strong>Team Styles and Positioning<\/strong><\/p><ul><li>New Player Positioning: With more freedom in motion, your teammates examine the pitch and react accordingly; darting forward in coordinated runs, or moving into space to provide consistent attacking support. New player positioning gives you a well-balanced and spread pitch with more opportunities in time and space to read the play.<\/li><li>Team Styles: A deep set of authentic playing styles attributed to several teams put the most-recognized tactics on the pitch in FIFA 18 - now in AI you will immediately recognize the tiki-taka of some of Europe\u2019s best clubs or the high-pressing style of teams in the Premier League. Feel a change in defensive and attacking approaches every time you choose a new club or opponent.<\/li><li>Dynamic Quick Substitutes: All-new context based substitution prompts allow players to easily make changes without pausing the match. Whether it's a missed chance, or necessary response to conceding a goal, you can instantly decide if a change is needed without visiting the menu.<\/li><\/ul><p><strong>Immersive Atmospheres<\/strong><\/p><ul><li>Regional Atmospheres: Authentic sun positions, cinematic atmosphere grading, signature pitch-side fixtures, authentic broadcast overlays in La Liga and MLS, on-pitch debris, club and stadium specific banners, adaptive commentary, and changes in pitch quality all come together to bring the most immersive football experiences to life in FIFA 18.<\/li><li>High-Def Dynamic Crowds: All-new individual crowd reactions and expanded regional chant support have you feeding off the energy of your supporters. Hear authentic chants build as you mount an attack, incite realistic excitement when you score and even interact with the crowd while celebrating.<\/li><\/ul><p><strong>Dramatic Moments<\/strong><\/p><ul><li>Wonder Goals: New locomotion and finishing animations unlock more fluid striking and heading, combining to increase the potential for more dramatic finishes. Player Personality ensures the heroes of the game stand tall in the biggest moments, finishing more often on the biggest stages.<\/li><li>New Crossing Control: All-new crossing controls provide the player with a variety of options to put the ball into the box, creating dynamic attacking chances. Whipped to the spot, arching, and back-stick crosses increase the variety of delivery to accurately pick out the attacking player.<\/li><\/ul><p><strong>THE JOURNEY: HUNTER RETURNS<\/strong><\/p><p>The World\u2019s Game takes you on a global journey as Alex Hunter returns along with a star-studded cast of characters and top football talent, like Ronaldo and other European stars. After a breathtaking first season in the Premier League, Hunter is gaining recognition from top clubs the world over and he is willing to explore any options coming his way. He feels ready to take the next step, his future is bright, and the world is talking about Hunter\u2026.but life in football isn\u2019t always fair.<\/p><ul><li>Tour the Football World: From a summer break in Brazil, to a pre-season tour in Los Angeles, Alex Hunter experiences diverse football landscapes in a truly global journey.<\/li><li>More to Play For: Chapter-based, short term objectives give Alex Hunter more to play for as he navigates his way through the second season of a prospering career.<\/li><li>A Star-Studded Cast: Cristiano Ronaldo leads a list of footballing greats and new, diverse characters in a star-studded cast well-suited to a blockbuster sequel.<\/li><li>Impactful Decisions: Players will be faced with bigger and more difficult choices that will alter the story with long-term consequences. Shape The Journey narrative in a personal way by making decisions that dictate Alex Hunter's career and effect relationships with characters both on and off the pitch.<\/li><li>Your Alex Hunter: Personalize the look of Alex Hunter by selecting his hair, tattoos, and clothing from a series of options. You can even pick Alex's dominant foot to make sure he suits your playing style.<\/li><li>Local Multiplayer: Play The Journey as a team through local multiplayer, and experience on-pitch action with friends.<\/li><li>New Playable Characters: Now players have the option to experience short, standalone stories with new playable characters that Alex meets throughout The Journey.<\/li><\/ul><p><strong>FIFA ULTIMATE TEAM<\/strong><\/p><p>FIFA ULTIMATE TEAM ICONS: The best of the best are coming to FIFA 18. Play with the most iconic legends of football including Ronaldo Nazário, available on PlayStation 4, Xbox One, and PC.<\/p><p>More ICONS and FUT features to be revealed throughout Summer 2017.<\/p><\/div>",
    "__v": 0
},
{
    "gameName": "Persona 5",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/d0a7d63a418b4c76989333722aca589f_Medium.png",
    "price": 69,
    "category": "ps4",
    "genre": "role-playing",
    "comments":[],
    "releaseDate": "2017-04-04T00:00:00.000Z",
    "description": "<div><h2>Persona 5<\/h2><p>Persona is an RPG series set in cities and high schools in modern day Japan. It focuses on the growth of adolescents who, upon the awakening of their 'Persona' abilities, overcome various trials together.<\/p><p>The heart of the Persona series is the clashing of ordinary events such as school life, friendship, and love, with the extraordinary such as urban legends, strange rumors, bizarre occurrences, and glimpses of the dark side of society. Its mysterious charm has fascinated fans all over the world.<\/p><p>The series has expanded to various media, including anime, music concerts, stage plays, and manga. Its popularity continues to soar by the day.<\/p><p><img src='//content.ebgames.com.au/website/images/detail/218427_detail_01.jpg'><\/p><p>Throughout the series, 'Persona' refers to a hidden 'personality' or the 'other self' that lurks within oneself. Personas manifest themselves as legendary gods and demons, and hold otherworldly powers. The adolescents who awaken to the Persona ability wield their powers to confront and overcome many perils that stand in their way.<\/p><h2><strong>Our leading man is a phantom thief<\/strong><\/h2><p>Beneath the veneer of typical urban high school life, a group of teenagers mask their mysterious alter egos, their 'phantom thief' side. Who are they? Why are they dressed as such? What are their motives? And... why are they being pursued?<\/p><p>A picaresque coming-of-age story, Persona 5 will bring a thrilling, new twist to the RPG genre!<\/p><div><img src='//content.ebgames.com.au/website/images/detail/218427_detail_02.jpg'><\/div><h2><strong>Set in Modern Day Tokyo<\/strong><\/h2><p>This is an account of the wild adventures experienced by a team of young misfits, who grow dramatically along the way. While attending Shujin High School, the protagonist will encounter a number of individuals, each with his or her own distinctive personality and charm. School life in the city is full of surprises and interesting events! It will most definitely be a fun year for the protagonist, living as an ordinary student.<\/p><div><img src='//content.ebgames.com.au/website/images/detail/218427_detail_03.jpg'><\/div><p>You will assume the role of a second-year high school student who becomes a Persona-user through an unexpected incident. Having moved to Tokyo just before the start of the school year, he finds residence at a cafe run by his parents' friend, and is about to get his first taste of school life in the big city.<\/p><p>However, he and his friends become involved in an incident which leads to the awakening of their Personas. No one would ever suspect that these adolescents will eventually shake the world...<\/p><p>Welcome to the next iteration of the Persona series, boasting a brand new metropolitan setting, all-new cast, and fresh, original story.<\/p><\/div>",
    "__v": 0
},
{
    "gameName": "Nier: Automata",
    "image": "https://c1-ebgames.eb-cdn.com.au/merchandising/images/packshots/2c72684f31c34b6b8f207d8ba74264c3_Medium.png",
    "price": 47,
    "category": "ps4",
    "genre": "action",
    "comments":[],
    "releaseDate": "2017-02-23T00:00:00.000Z",
    "description": "<div><div><img src='//content.ebgames.com.au/website/images/detail/208753_detail_01.jpg'><\/div><ul><li>Fast action combat<\/li><li>Interchangeable weapon loadouts<\/li><li>Distinctive character design by Akihiko Yoshida<\/li><li>Music composed by Keiichi Okabe<\/li><\/ul><p>NieR: Automata is a new third-person action RPG follow-up to the 2010 cult hit, NieR. Offering a fresh blend of action and RPG gameplay styles, NieR New Project is currently being developed in collaboration with PlatinumGames, the studio known for its groundbreaking advancements in the action genre.<\/p><p>The game's all-star development team is helmed by producer Yosuke Saito, known for his work on DRAGON QUEST X and NieR. The previous game's director, YOKO TARO returns for the new project as well as composer Keiichi Okabe, whose award-winning score to the original became one of the greatest accomplishments in gaming music.<\/p><p>New to the series is character designer Akihiko Yoshida from CyDesignation, Inc., well known for his work in BRAVELY DEFAULT and the FINAL FANTASY series, as well as game designer Takahisa Taura, with Metal Gear Rising: Revengence to his credit.<\/p><h2><strong>Story<\/strong><\/h2><p>The distant future... Invaders from another world attack without warning, unleashing a new type of threat: weapons known as 'machine lifeforms.' In the face of this insurmountable threat, mankind is driven from Earth and takes refuge on the Moon. The Council of Humanity organizes a resistance of android soldiers in an effort to take back their planet. To break the deadlock, the Resistance deploys a new unit of android infantry: YoRHa. In the forsaken wasteland below, the war between the machines and the androids rages on. A war that is soon to unveil the long-forgotten truth of this world...<\/p><\/div>",
    "__v": 0
}]

//Game.create(seedGames);   