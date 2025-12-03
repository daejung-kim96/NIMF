import { useState } from 'react';
import clsx from 'clsx';
import PricingCard from '@/pages/pricing/PricingCard';
import axios from '@/lib/axios';

import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import CheckIcon from '@/assets/icons/check.svg?react';
import XIcon from '@/assets/icons/x.svg?react';
import ConfirmModal from '@/modals/ConfirmModal';

const iconStyle = 'w-4 h-4 mr-2';

function Pricing() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  // 서버 요청 중 플랜(중복 클릭 방지 용)
  const [selectedPlan, setSelectedPlan] = useState(null);

  // 모달 상태
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);

  const openConfirm = (plan) => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    // 같은 플랜이거나 서버 처리중이면 무시
    if (user?.pricing === plan || selectedPlan) return;

    setPendingPlan(plan);
    setIsConfirmOpen(true);
  };

  const closeConfirm = () => {
    setIsConfirmOpen(false);
    setPendingPlan(null);
  };

  const updateUserPlan = async (newPlan) => {
    if (!user?.email) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (user.pricing === newPlan || selectedPlan) return;

    const prevUser = user;
    try {
      setSelectedPlan(newPlan);
      const response = await axios.put('/user/pricing', { pricing: newPlan });

      if (response.data?.success) {
        useAuthStore.setState({
          user: {
            ...user,
            pricing: response.data.pricing,
          },
        });
        const PLAN_LABEL = { free: 'Free', pro: 'Pro', business: 'Business' };
        alert(`플랜이 ${PLAN_LABEL[newPlan] ?? newPlan}로 변경되었습니다.`);
      } else {
        useAuthStore.setState({ user: prevUser });
        alert(response.data?.message || '플랜 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('에러 발생:', error);
      useAuthStore.setState({ user: prevUser });
      alert('플랜 변경 중 오류가 발생했습니다.');
    } finally {
      setSelectedPlan(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center space-y-6">
        <p className="text-white text-lg">로그인 후 이용 가능한 페이지입니다.</p>
        <button
          onClick={() => navigate('/login')}
          className="bg-white text-zinc-900 font-semibold py-2 px-6 rounded-lg hover:bg-gray-200 transition"
        >
          로그인 하러가기
        </button>
      </div>
    );
  }

  const userPlan = user?.pricing || 'free';

  const Feature = ({ icon, text }) => (
    <div className="flex items-center text-sm text-neutral-200 leading-relaxed">
      {icon}
      <span>{text}</span>
    </div>
  );

  const plans = [
    {
      title: 'Free',
      price: '0',
      priceUnit: 'KRW / month',
      buttonText: 'Try for free',
      features: [
        <Feature
          key="f1"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={<span>누구나 무료로 시작</span>}
        />,
        <Feature
          key="f2"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={<span>하루에 한 시간, NIMF를 체험해보세요!</span>}
        />,
        <Feature
          key="f3"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={
            <>
              <span>실시간 블러처리·음소거 기능과</span>
              <br />
              <span>로그 정보를 받아보세요!</span>
            </>
          }
        />,
        <Feature
          key="f4"
          icon={<XIcon className={clsx(iconStyle, 'text-red-500')} />}
          text={<span>금지어 설정 기능 사용 불가능</span>}
        />,
      ],
      onClick: () => openConfirm('free'),
      disabled: ['free'].includes(userPlan),
    },
    {
      title: 'Pro',
      price: '49,000',
      priceUnit: 'KRW / month',
      buttonText: 'Get started',
      features: [
        <Feature
          key="p1"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={<span>방송 매니저가 필요한 1인 크리에이터용</span>}
        />,
        <Feature
          key="p2"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={<span>시간 제한 없이 무제한 사용</span>}
        />,
        <Feature
          key="p3"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={
            <>
              <span>NIMF의 모든 기능을 사용해보세요.</span>
              <br />
              <span>블러처리 / 음소거 / 로그 정보 / 금지어 설정</span>
            </>
          }
        />,
      ],
      onClick: () => openConfirm('pro'),
      disabled: ['pro'].includes(userPlan),
    },
    {
      title: 'Business',
      price: '49,000',
      priceUnit: 'KRW / month',
      buttonText: 'Get started',
      features: [
        <Feature
          key="b1"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={<span>실시간 모니터링 팀이 있는 MCN 전용</span>}
        />,
        <Feature
          key="b2"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={<span>시간 제한 없이 무제한 사용</span>}
        />,
        <Feature
          key="b3"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={
            <>
              <span>NIMF의 모든 기능을 사용해보세요.</span>
              <br />
              <span>블러처리 / 음소거 / 로그 정보 / 금지어 설정</span>
            </>
          }
        />,
        <Feature
          key="b4"
          icon={<CheckIcon className={clsx(iconStyle, 'text-green-500')} />}
          text={<span>최대 10명까지 공동 사용 가능</span>}
        />,
      ],
      onClick: () => openConfirm('business'),
      disabled: ['business'].includes(userPlan),
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-900 py-16 px-4 flex justify-center">
      <div className="w-full max-w-[1200px] flex flex-col justify-start items-center gap-12">
        <div className="self-stretch flex flex-col justify-start items-center gap-2">
          <div className="self-stretch text-center text-neutral-50 text-3xl font-bold leading-9">
            PRICING
          </div>
          <div className="self-stretch text-center text-zinc-400 text-base font-normal leading-normal">
            처음 써보는 분도, 1인 방송 크리에이터도, 대규모 콘텐츠 팀도 모두 만족할 수 있도록.
            <br />
            NIMF는 다양한 니즈에 맞춘 요금제를 제공합니다.
          </div>
        </div>

        {/* 요금제 카드 배치 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
          {plans.map((plan, idx) => (
            <PricingCard key={idx} {...plan} />
          ))}
        </div>

        <button
          onClick={() => navigate('/studio')}
          className="self-stretch text-center text-neutral-400 text-sm font-semibold leading-tight"
        >
          지금 요금제를 유지할게요 &gt;
        </button>
      </div>

      {/* ✅ 확인 모달 */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={closeConfirm}
        onCancel={closeConfirm}
        onConfirm={() => {
          const plan = pendingPlan;
          closeConfirm(); // 모달 먼저 닫고
          updateUserPlan(plan); // 실제 변경 호출
        }}
        title="요금제 변경"
        body={
          pendingPlan
            ? `정말로 요금제를 '${pendingPlan}'(으)로 변경하시겠습니까?`
            : '정말로 요금제를 변경하시겠습니까?'
        }
        confirmText="예"
        cancelText="아니오"
        iconVariant="pricing"
      />
    </div>
  );
}

export default Pricing;
