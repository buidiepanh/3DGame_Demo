import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ===================== DATA ===================== */
const TRASH_CATEGORIES = [
  {
    id: "organic",
    name: "Rác hữu cơ",
    color: "#10b981",
    bgGradient: "linear-gradient(135deg, #10b981, #059669)",
    icon: "🌱",
    description: "Thực phẩm, lá cây, phân hủy sinh học",
  },
  {
    id: "inorganic",
    name: "Rác vô cơ",
    color: "#3b82f6",
    bgGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    icon: "♻️",
    description: "Nhựa, kim loại, thủy tinh",
  },
  {
    id: "hazardous",
    name: "Rác nguy hại",
    color: "#ef4444",
    bgGradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    icon: "⚠️",
    description: "Pin, hóa chất, thuốc trừ sâu",
  },
  {
    id: "recyclable",
    name: "Rác tái chế",
    color: "#f59e0b",
    bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    icon: "📦",
    description: "Giấy, bìa carton, chai lọ",
  },
];

const TRASH_ITEMS = [
  {
    id: 1,
    name: "Vỏ chuối",
    category: "organic",
    icon: "🍌",
    info: "Phân hủy nhanh, tốt cho phân compost",
  },
  {
    id: 2,
    name: "Chai nhựa",
    category: "recyclable",
    icon: "🍾",
    info: "Có thể tái chế thành sản phẩm mới",
  },
  {
    id: 3,
    name: "Pin cũ",
    category: "hazardous",
    icon: "🔋",
    info: "Chứa kim loại nặng, cần xử lý đặc biệt",
  },
  {
    id: 4,
    name: "Túi nilon",
    category: "inorganic",
    icon: "🛍️",
    info: "Phân hủy rất lâu, gây ô nhiễm",
  },
  {
    id: 5,
    name: "Vỏ cam",
    category: "organic",
    icon: "🍊",
    info: "Giàu dinh dưỡng cho đất",
  },
  {
    id: 6,
    name: "Hộp giấy",
    category: "recyclable",
    icon: "📦",
    info: "Dễ tái chế, tiết kiệm tài nguyên",
  },
  {
    id: 7,
    name: "Bóng đèn",
    category: "hazardous",
    icon: "💡",
    info: "Chứa thủy ngân, rất nguy hiểm",
  },
  {
    id: 8,
    name: "Lon nhôm",
    category: "recyclable",
    icon: "🥫",
    info: "Tái chế tiết kiệm 95% năng lượng",
  },
  {
    id: 9,
    name: "Lá cây khô",
    category: "organic",
    icon: "🍂",
    info: "Nguồn carbon tốt cho compost",
  },
  {
    id: 10,
    name: "Chai thủy tinh",
    category: "inorganic",
    icon: "🍷",
    info: "Có thể tái sử dụng nhiều lần",
  },
  {
    id: 11,
    name: "Thuốc trừ sâu",
    category: "hazardous",
    icon: "🧴",
    info: "Chất độc, cần xử lý an toàn",
  },
  {
    id: 12,
    name: "Báo cũ",
    category: "recyclable",
    icon: "📰",
    info: "Nguồn giấy tái chế tốt",
  },
];

/* ===================== GAME CONFIG ===================== */
const LEVEL_REWARD = 70; // Xu nhận được nếu đạt yêu cầu
const STREAK_BONUS = 5; // Bonus xu cho chuỗi >= 5
const REQUIRED_ACCURACY = 75; // Cần đúng >= 75% để nhận xu

/* ===================== MAIN COMPONENT ===================== */
export default function SortingGame() {
  const [gameState, setGameState] = useState("playing");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [gameItems, setGameItems] = useState([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  // Touch/Mobile support
  const [touchStart, setTouchStart] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const binRefs = useRef({});

  useEffect(() => {
    const shuffled = [...TRASH_ITEMS].sort(() => Math.random() - 0.5);
    setGameItems(shuffled);
  }, []);

  const currentItem = gameItems[currentIndex];
  const progress = ((currentIndex + 1) / gameItems.length) * 100;

  // Desktop drag handlers
  const handleDragStart = (e, item) => {
    e.stopPropagation();
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, categoryId) => {
    e.preventDefault();
    if (!draggedItem || showFeedback) return;
    processAnswer(categoryId);
  };

  // Mobile touch handlers
  const handleTouchStart = (e, item) => {
    if (showFeedback) return;
    e.preventDefault();
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setDraggedItem(item);
    setIsDragging(true);
    setDragPosition({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || showFeedback) return;
    e.preventDefault();
    const touch = e.touches[0];
    setDragPosition({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e) => {
    if (!isDragging || showFeedback) return;
    e.preventDefault();

    const touch = e.changedTouches[0];
    const dropX = touch.clientX;
    const dropY = touch.clientY;

    let droppedBin = null;
    Object.entries(binRefs.current).forEach(([categoryId, ref]) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (
          dropX >= rect.left &&
          dropX <= rect.right &&
          dropY >= rect.top &&
          dropY <= rect.bottom
        ) {
          droppedBin = categoryId;
        }
      }
    });

    setIsDragging(false);
    setDragPosition({ x: 0, y: 0 });

    if (droppedBin) {
      processAnswer(droppedBin);
    } else {
      setDraggedItem(null);
    }
  };

  const processAnswer = (categoryId) => {
    if (!draggedItem) return;

    const isCorrect = draggedItem.category === categoryId;
    const category = TRASH_CATEGORIES.find((c) => c.id === categoryId);

    const answerData = {
      item: draggedItem,
      selectedCategory: category,
      isCorrect,
      correctCategory: TRASH_CATEGORIES.find(
        (c) => c.id === draggedItem.category
      ),
    };

    setAnswers([...answers, answerData]);

    if (isCorrect) {
      setStreak(streak + 1);
      setMaxStreak(Math.max(maxStreak, streak + 1));
      setCorrectCount(correctCount + 1);
      setFeedbackData({
        ...answerData,
        message: "Chính xác!",
        emoji: "✅",
      });
    } else {
      setStreak(0);
      setWrongCount(wrongCount + 1);
      setFeedbackData({
        ...answerData,
        message: "Chưa đúng!",
        emoji: "❌",
      });
    }

    setShowFeedback(true);
    setDraggedItem(null);
  };

  const handleContinue = () => {
    setShowFeedback(false);
    setFeedbackData(null);
    setDraggedItem(null);

    if (currentIndex < gameItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setGameState("summary");
    }
  };

  const handleClaimReward = () => {
    window.location.href = "/";
  };

  const formatTime = (seconds) => {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}p${secs}s`;
    }
    return `${seconds}s`;
  };

  // Summary Screen
  if (gameState === "summary") {
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const accuracy = Math.round((correctCount / gameItems.length) * 100);
    const avgTimePerItem = Math.round(totalTime / gameItems.length);

    // Tính xu nhận được
    const passedAccuracy = accuracy >= REQUIRED_ACCURACY;
    const baseCoins = passedAccuracy ? LEVEL_REWARD : 0;
    const streakBonusCoins = maxStreak >= 5 ? STREAK_BONUS : 0;
    const totalCoins = baseCoins + streakBonusCoins;

    let rating = "";
    let ratingEmoji = "";
    let ratingColor = "";

    if (accuracy >= 90) {
      rating = "Xuất sắc!";
      ratingEmoji = "🏆";
      ratingColor = "#f59e0b";
    } else if (accuracy >= 75) {
      rating = "Tốt lắm!";
      ratingEmoji = "⭐";
      ratingColor = "#10b981";
    } else if (accuracy >= 60) {
      rating = "Khá đấy!";
      ratingEmoji = "👍";
      ratingColor = "#3b82f6";
    } else {
      rating = "Cố gắng hơn nhé!";
      ratingEmoji = "💪";
      ratingColor = "#6b7280";
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-8 max-w-2xl w-full border-4 border-purple-200"
        >
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-center mb-8"
          >
            <div className="text-8xl mb-4">{ratingEmoji}</div>
            <h1
              className="text-4xl font-bold mb-2"
              style={{ color: ratingColor }}
            >
              {rating}
            </h1>
            <p className="text-gray-600 text-lg">
              Bạn đã hoàn thành trò chơi phân loại rác!
            </p>
          </motion.div>

          {/* Phần hiển thị xu */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-3xl p-8 text-center shadow-2xl border-4 border-yellow-300 relative overflow-hidden">
              {/* Sparkle effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent" />

              <div className="relative z-10">
                <div className="text-7xl mb-2 drop-shadow-lg">🪙</div>
                <div className="text-black drop-shadow-md">
                  <div className="text-7xl font-black mb-2 tracking-tight">
                    {totalCoins}
                  </div>
                  <div className="text-2xl font-bold uppercase tracking-wide">
                    Xu nhận được
                  </div>
                  {passedAccuracy && (
                    <div className="mt-4 text-base font-semibold space-y-1 bg-black/20 rounded-2xl p-3 backdrop-blur-sm">
                      <div>💰 Phần thưởng màn: {LEVEL_REWARD} xu</div>
                      {streakBonusCoins > 0 && (
                        <div>🔥 Bonus chuỗi 5+: +{streakBonusCoins} xu</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-lg border-2 border-blue-300"
            >
              <div className="text-5xl font-bold mb-2">{accuracy}%</div>
              <div className="text-sm font-semibold uppercase tracking-wide">
                Độ chính xác
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg border-2 border-green-300"
            >
              <div className="text-5xl font-bold mb-2">
                {correctCount}/{gameItems.length}
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">
                Câu đúng
              </div>
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg border-2 border-green-300"
            >
              <div className="text-5xl font-bold mb-2">{maxStreak}</div>
              <div className="text-sm font-semibold uppercase tracking-wide">
                Chuỗi đúng tối đa
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-6 text-white shadow-lg border-2 border-purple-300"
            >
              <div className="text-5xl font-bold mb-2">
                {formatTime(totalTime)}
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">
                Tổng thời gian
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-6 mb-6 border-2 border-gray-300 shadow-inner"
          >
            <h3 className="font-bold text-xl mb-4 text-gray-900">
              📊 Thống kê chi tiết
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm">
                <span className="text-gray-700 font-medium">
                  ✅ Phân loại đúng:
                </span>
                <span className="font-bold text-green-600 text-xl">
                  {correctCount}/{gameItems.length}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm">
                <span className="text-gray-700 font-medium">
                  ❌ Phân loại sai:
                </span>
                <span className="font-bold text-red-600 text-xl">
                  {wrongCount}/{gameItems.length}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm">
                <span className="text-gray-700 font-medium">
                  ⏱️ Thời gian trung bình:
                </span>
                <span className="font-bold text-blue-600 text-xl">
                  {avgTimePerItem}s/câu
                </span>
              </div>
              <div className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm">
                <span className="text-gray-700 font-medium">
                  🎯 Yêu cầu đạt:
                </span>
                <span
                  className={`font-bold text-xl ${
                    passedAccuracy ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ≥{REQUIRED_ACCURACY}% (
                  {passedAccuracy ? "Đạt ✓" : "Chưa đạt ✗"})
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="w-full h-6 bg-gray-300 rounded-full overflow-hidden mb-6 border-2 border-gray-400 shadow-inner"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${accuracy}%` }}
              transition={{ delay: 1, duration: 1 }}
              className="h-full bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 shadow-lg relative"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/30 to-transparent" />
            </motion.div>
          </motion.div>

          {!passedAccuracy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="bg-gradient-to-br from-red-100 to-red-200 border-3 border-red-400 rounded-2xl p-5 mb-4 text-center shadow-lg"
            >
              <p className="text-red-700 font-bold text-xl mb-2">
                ⚠️ Chưa đạt {REQUIRED_ACCURACY}% để nhận xu
              </p>
              <p className="text-red-600 font-medium text-base">
                Bạn cần trả lời đúng ít nhất{" "}
                {Math.ceil((REQUIRED_ACCURACY / 100) * gameItems.length)}/
                {gameItems.length} câu
              </p>
            </motion.div>
          )}

          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
            whileHover={{ scale: passedAccuracy ? 1.05 : 1 }}
            whileTap={{ scale: passedAccuracy ? 0.95 : 1 }}
            onClick={handleClaimReward}
            disabled={!passedAccuracy}
            className={`w-full font-bold py-4 rounded-2xl text-xl shadow-lg transition-all ${
              passedAccuracy
                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-xl cursor-pointer"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {passedAccuracy
              ? `🎁 Nhận ${totalCoins} xu và về trang chủ`
              : "❌ Không đủ điều kiện nhận xu"}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Game Playing Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 text-white"
        >
          <div className="flex justify-between items-center mb-3">
            <div className="text-xl font-bold">
              Câu {currentIndex + 1}/{gameItems.length}
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-lg">
                🔥 Chuỗi: <span className="font-bold">{streak}</span>
              </div>
              <div className="text-2xl font-bold">🪙 {LEVEL_REWARD}</div>
            </div>
          </div>

          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-green-400 to-blue-500"
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>

        {currentItem && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6 text-center">
            <p className="text-gray-500 text-lg mb-4">
              Kéo icon rác vào thùng phù hợp 👇
            </p>

            <motion.div
              key={currentItem.id}
              draggable
              onDragStart={(e) => handleDragStart(e, currentItem)}
              onTouchStart={(e) => handleTouchStart(e, currentItem)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="inline-block cursor-grab active:cursor-grabbing touch-none"
              style={{ userSelect: "none" }}
            >
              <div className="text-9xl mb-4">{currentItem.icon}</div>
            </motion.div>

            <h2 className="text-4xl font-bold text-gray-800 mb-2">
              {currentItem.name}
            </h2>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TRASH_CATEGORIES.map((category, index) => (
            <motion.div
              key={category.id}
              ref={(el) => (binRefs.current[category.id] = el)}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, category.id)}
              className="rounded-2xl p-6 text-white shadow-lg min-h-[200px]
               flex flex-col items-center justify-center transition-transform hover:scale-105"
              style={{ background: category.bgGradient }}
            >
              <div className="text-6xl mb-3">{category.icon}</div>
              <h3 className="font-bold text-xl mb-2">{category.name}</h3>
              <p className="text-sm opacity-90 text-center">
                {category.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-white/80 text-sm"
        >
          💡 Phần thưởng: {LEVEL_REWARD} xu • Bonus chuỗi ≥5: +{STREAK_BONUS} xu
          • Yêu cầu: ≥{REQUIRED_ACCURACY}% đúng
        </motion.div>
      </div>

      {isDragging && draggedItem && (
        <div
          style={{
            position: "fixed",
            left: dragPosition.x - 50,
            top: dragPosition.y - 50,
            width: 100,
            height: 100,
            pointerEvents: "none",
            zIndex: 9999,
            fontSize: "80px",
            textAlign: "center",
            opacity: 0.8,
          }}
        >
          {draggedItem.icon}
        </div>
      )}

      <AnimatePresence>
        {showFeedback && feedbackData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="text-center">
                <div className="text-8xl mb-4">{feedbackData.emoji}</div>
                <h2
                  className="text-4xl font-bold mb-4"
                  style={{
                    color: feedbackData.isCorrect ? "#10b981" : "#ef4444",
                  }}
                >
                  {feedbackData.message}
                </h2>

                {feedbackData.isCorrect ? (
                  <div className="space-y-3">
                    <p className="text-gray-600">{feedbackData.item.info}</p>
                    {streak > 1 && (
                      <p className="text-orange-500 font-bold">
                        🔥 Chuỗi {streak} lần đúng liên tiếp!
                      </p>
                    )}
                    {streak >= 5 && (
                      <p className="text-purple-600 font-bold">
                        ⭐ Chuỗi ≥5! Sẽ nhận +{STREAK_BONUS} xu bonus!
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-red-50 rounded-2xl p-4">
                      <p className="text-gray-700 mb-2">
                        <span className="font-bold">
                          {feedbackData.item.name}
                        </span>{" "}
                        nên bỏ vào:
                      </p>
                      <div
                        className="font-bold text-xl"
                        style={{ color: feedbackData.correctCategory.color }}
                      >
                        {feedbackData.correctCategory.icon}{" "}
                        {feedbackData.correctCategory.name}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-2xl p-4">
                      <p className="text-sm text-gray-600">
                        💡 {feedbackData.item.info}
                      </p>
                    </div>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleContinue}
                  className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-4 rounded-2xl text-xl shadow-lg"
                >
                  {currentIndex < gameItems.length - 1
                    ? "Tiếp tục ➡️"
                    : "Xem kết quả 🎉"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
