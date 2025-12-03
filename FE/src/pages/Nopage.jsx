import { useNavigate } from 'react-router-dom';

function Nopage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-900 py-16 px-4 flex justify-center">
      <div className="w-[1200px] inline-flex flex-col justify-center items-center gap-12">
        <div className="flex flex-col justify-center items-center gap-4">
          <div className="text-neutral-50 text-3xl font-bold text-center leading-9">
            코런건 없어용~
          </div>
          <div className="text-zinc-400 text-base font-normal text-center leading-normal">
            요청하신 페이지가 존재하지 않거나, 이동이 잘못되었어요.
            <br />
            이전 페이지로 돌아가시거나 메인 페이지로 이동해 주세요.
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-zinc-900 text-sm font-semibold py-2 px-6 rounded-lg hover:bg-gray-200 transition"
          >
            이전 페이지로
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-emerald-500 text-white text-sm font-semibold py-2 px-6 rounded-lg hover:bg-emerald-400 transition"
          >
            메인으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

export default Nopage;
