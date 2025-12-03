import { useNavigate } from 'react-router-dom';

function PricingCard({ title, price, priceUnit, buttonText, features, link, disabled, onClick }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else if (link) {
      navigate(link);
    }
  };

  return (
    <div className="w-full h-full p-6 sm:p-8 md:p-10 bg-zinc-800 rounded-2xl flex flex-col justify-start items-start gap-8">
      {/* 요금제 이름 */}
      <div className="text-zinc-400 text-lg sm:text-xl md:text-2xl font-bold leading-loose">
        {title}
      </div>

      {/* 가격 및 버튼 */}
      <div className="w-full flex flex-col justify-start items-start gap-5">
        <div className="flex justify-start items-end gap-2">
          <div className="text-neutral-50 text-4xl font-extrabold leading-[1.2]">{price}</div>
          <div className="text-zinc-400 text-xs sm:text-sm md:text-base font-medium leading-normal">
            {priceUnit}
          </div>
        </div>

        <button
          onClick={handleClick}
          disabled={disabled}
          className={`w-full px-6 py-2.5 rounded-xl flex justify-center items-center gap-2.5 transition-colors ${
            disabled ? 'bg-zinc-700 cursor-not-allowed' : 'bg-neutral-50 hover:bg-gray-200'
          }`}
        >
          <div
            className={`font-bold leading-6 sm:leading-7 ${
              disabled ? 'text-zinc-500' : 'text-zinc-900'
            } text-sm sm:text-base md:text-lg`}
          >
            {disabled ? 'Subscribed' : buttonText}
          </div>
        </button>
      </div>

      {/* 구분선 */}
      <div className="w-full h-0 border-t border-zinc-600"></div>

      {/* 기능 목록 */}
      <div className="w-full text-left flex flex-col justify-start items-start gap-4">
        {features.map((feature, index) => (
          <div key={index} className="w-full flex justify-start items-center gap-2">
            <div className="text-zinc-400 text-xs sm:text-sm md:text-base font-normal leading-normal">
              {feature}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PricingCard;
