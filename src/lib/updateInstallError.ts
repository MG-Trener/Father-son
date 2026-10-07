export type ApkInstallErrorCopy = {
  title: string;
  message: string;
};

const errorCode = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '';
};

export function getApkInstallErrorCopy(error: unknown): ApkInstallErrorCopy {
  const code = errorCode(error);

  if (code.includes('PERMISSION')) {
    return {
      title: 'Разреши установку',
      message: 'Android должен разрешить «Папа & Я» устанавливать собственные обновления. После разрешения нажми «Обновить» ещё раз.',
    };
  }
  if (code.includes('AUTH_REQUIRED')) {
    return {
      title: 'Нужно войти',
      message: 'APK хранится в приватном семейном хранилище. Войди в «Папа & Я» и повтори обновление.',
    };
  }
  if (code.includes('SIZE_')) {
    return {
      title: 'Файл не прошёл проверку',
      message: 'Размер APK не совпадает с опубликованными метаданными. Установка отменена — попробуй позже.',
    };
  }
  if (code.includes('SHA256')) {
    return {
      title: 'Файл не прошёл проверку',
      message: 'Контрольная сумма APK не совпала с опубликованной версией. Установка отменена для безопасности.',
    };
  }
  if (code.includes('SIGNED_URL')) {
    return {
      title: 'Ссылка устарела',
      message: 'Не удалось получить временную защищённую ссылку на APK. Повтори обновление.',
    };
  }
  if (code.includes('URL_NOT_PUBLISHED')) {
    return {
      title: 'Сборка ещё публикуется',
      message: 'Новая версия зарегистрирована, но APK пока не опубликован. Попробуй проверить обновление позже.',
    };
  }
  if (code.includes('DOWNLOAD_FAILED')) {
    return {
      title: 'Не удалось скачать обновление',
      message: 'Файл APK не загрузился полностью. Проверь интернет и повтори попытку.',
    };
  }
  if (code.includes('ANDROID_ONLY')) {
    return {
      title: 'Обновление недоступно',
      message: 'Встроенная установка APK работает только на Android.',
    };
  }

  return {
    title: 'Не удалось обновить',
    message: 'Проверь интернет и попробуй ещё раз. Текущая версия продолжит работать.',
  };
}
